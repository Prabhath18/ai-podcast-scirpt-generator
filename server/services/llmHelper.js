// Wraps the raw `generate()` call with the three things every structured
// LLM call in this app needs: pull the JSON object out of whatever the model
// wrapped it in (code fences, prose, <think> blocks), parse it, and validate it
// against a caller-supplied validator -- retrying exactly once, with the
// validation errors fed back to the model, before giving up. This is the only
// place that retry policy lives, and it is the same for every provider.
import { generate, generateStream } from './llm.js';
import { extractJson } from '../utils/extractJson.js';

// Failures that asking the model again cannot fix, and that would only repeat the wait
// or the error: a bad setup, a timeout (another 90 s), a rate limit, rejected credentials.
const NO_RETRY_CODES = new Set(['LLM_NOT_CONFIGURED', 'LLM_TIMEOUT', 'LLM_RATE_LIMITED', 'LLM_AUTH', 'LLM_ABORTED']);
// Provider failures keep their own code in the final error so the client can say what
// happened. Everything else still ends as LLM_INVALID_RESPONSE, as it always has.
const PROVIDER_CODES = new Set([...NO_RETRY_CODES, 'LLM_PROVIDER_ERROR']);

/**
 * @param {string} prompt
 * @param {object} schema Response schema (Gemini dialect; see services/llm.js).
 * @param {(data: unknown) => { valid: boolean, errors: unknown[], value?: object, salvage?: object }} validate
 *   A validator may return `value`, a cleaned-up payload to hand back instead
 *   of the raw parse, and may attach `salvage`: a usable subset of an
 *   otherwise invalid response (e.g. the variations that did validate). If the
 *   retry also fails, the best salvage is returned instead of an error.
 * @param {object} [options] Streaming. Leave out for the ordinary single call. With `onChunk`, each
 *   attempt is streamed and `onChunk(delta)` sees the text as it is written; the finished text goes
 *   through exactly the same parse, validate and retry-once steps, so streaming changes only how
 *   progress is reported, never what is accepted.
 * @param {(delta: string) => void} [options.onChunk]
 * @param {(info: { reason: 'retry' | 'fallback', provider?: string }) => void} [options.onRestart] the text is
 *   about to start over (a retry, or the fallback provider), so a consumer that accumulates chunks should reset
 * @param {AbortSignal} [options.signal] stops the request and any retry (the caller went away)
 * @returns {Promise<object>} the parsed, validated JSON payload
 * @throws {Error & { code: string, details?: unknown }}
 */
export async function callStructuredLLM(prompt, schema, validate, options = {}) {
  const { onChunk, onRestart, signal } = options;
  let lastErrorDetails;
  let lastErrorMessage = 'Unknown error.';
  let lastErrorCode;
  let salvage = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptPrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: Your previous response was invalid for this reason: ${JSON.stringify(
            lastErrorDetails,
          )}. Return ONLY corrected JSON that satisfies the schema exactly. Do not include any commentary or markdown formatting.`;

    if (attempt > 0) onRestart?.({ reason: 'retry' });

    try {
      // eslint-disable-next-line no-await-in-loop -- intentionally sequential retry
      const raw = onChunk ? await generateStream(attemptPrompt, schema, onChunk, { signal, onRestart }) : await generate(attemptPrompt, schema);
      const data = JSON.parse(extractJson(raw));
      const result = validate(data);
      if (result.valid) return result.value ?? data;
      if (result.salvage) salvage = result.salvage;
      lastErrorDetails = result.errors;
      lastErrorMessage = 'The AI response did not satisfy the required schema.';
      lastErrorCode = undefined;
    } catch (err) {
      if (NO_RETRY_CODES.has(err.code) || signal?.aborted) throw err;
      lastErrorDetails = [{ field: 'response', message: err.message }];
      lastErrorMessage = err instanceof SyntaxError ? 'The AI response was not valid JSON.' : err.message;
      lastErrorCode = err.code;
    }
  }

  if (salvage) return salvage;

  const error = new Error(`${lastErrorMessage} (after one retry)`);
  error.code = PROVIDER_CODES.has(lastErrorCode) ? lastErrorCode : 'LLM_INVALID_RESPONSE';
  error.details = lastErrorDetails;
  throw error;
}
