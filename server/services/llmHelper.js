// Wraps the raw `generate()` call with the three things every structured
// LLM call in this app needs: strip markdown code fences some models wrap
// JSON in, parse it, and validate it against a caller-supplied validator --
// retrying exactly once, with the validation errors fed back to the model,
// before giving up. This is the only place that retry policy lives.
import { generate } from './llm.js';

function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * @param {string} prompt
 * @param {object} schema Gemini response schema (JSON mode).
 * @param {(data: unknown) => { valid: boolean, errors: unknown[] }} validate
 * @returns {Promise<object>} the parsed, validated JSON payload
 * @throws {Error & { code: string, details?: unknown }}
 */
export async function callStructuredLLM(prompt, schema, validate) {
  let lastErrorDetails;
  let lastErrorMessage = 'Unknown error.';

  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptPrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: Your previous response was invalid for this reason: ${JSON.stringify(
            lastErrorDetails,
          )}. Return ONLY corrected JSON that satisfies the schema exactly. Do not include any commentary or markdown formatting.`;

    try {
      // eslint-disable-next-line no-await-in-loop -- intentionally sequential retry
      const raw = await generate(attemptPrompt, schema);
      const cleaned = stripCodeFences(raw);
      const data = JSON.parse(cleaned);
      const result = validate(data);
      if (result.valid) return data;
      lastErrorDetails = result.errors;
      lastErrorMessage = 'The AI response did not satisfy the required schema.';
    } catch (err) {
      if (err.code === 'LLM_NOT_CONFIGURED') throw err;
      lastErrorDetails = [{ field: 'response', message: err.message }];
      lastErrorMessage = err instanceof SyntaxError ? 'The AI response was not valid JSON.' : err.message;
    }
  }

  const error = new Error(`${lastErrorMessage} (after one retry)`);
  error.code = 'LLM_INVALID_RESPONSE';
  error.details = lastErrorDetails;
  throw error;
}
