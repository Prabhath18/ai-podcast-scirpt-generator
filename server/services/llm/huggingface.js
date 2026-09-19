// The Hugging Face provider, via Inference Providers' OpenAI-compatible chat completions
// endpoint (https://huggingface.co/docs/inference-providers). Plain fetch, no SDK: it is
// one POST. Configuration, all from the environment at call time:
//   HF_TOKEN        required. A fine-grained token with "Make calls to Inference Providers".
//   HF_MODEL        an org/model id, optionally with a routing suffix (":fastest", ":cheapest",
//                   or ":<provider>", e.g. "meta-llama/Llama-3.1-8B-Instruct:nscale").
//   HF_BASE_URL     override the router URL.
//   HF_TIMEOUT_MS   per-request timeout (default 60s: models can cold-start).
//   HF_MAX_TOKENS   output cap (default 6000: three outline variations are long).
//
// Open models do not reliably enforce a schema, so this adapter (1) asks for JSON mode,
// falling back to a plain request if the provider rejects `response_format`, and (2) always
// puts the JSON Schema and a short example in the prompt. Whatever comes back is checked by
// the same parse-validate-retry code in llmHelper.js as the Gemini path.
import { exampleFromSchema, toJsonSchema } from './jsonSchema.js';

export const DEFAULT_HF_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';
const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_TOKENS = 6000;
const TEMPERATURE = 0.4; // steadier JSON than the default; still varied enough for creative text
const SYSTEM_PROMPT =
  'You are a precise assistant. Reply with exactly one JSON object and nothing else: no markdown fences, no commentary before or after it.';

function llmError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function positiveNumberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** The app's prompt, plus the schema (standard JSON Schema) and a short example, as plain text. */
export function buildHuggingFacePrompt(prompt, responseSchema) {
  if (!responseSchema) return prompt;
  return `${prompt}

Reply with a single JSON object that matches this JSON Schema exactly. Output the JSON only.

JSON Schema:
${JSON.stringify(toJsonSchema(responseSchema), null, 2)}

Example of the required shape. The values are placeholders, and arrays show one item; include as many items as the instructions above ask for:
${JSON.stringify(exampleFromSchema(responseSchema))}`;
}

function detailFrom(body) {
  const detail = body?.error?.message ?? body?.error ?? body?.message ?? (typeof body === 'string' ? body : '');
  return typeof detail === 'string' ? detail.trim().slice(0, 200) : '';
}

/** Turns a non-2xx answer into an error whose code says what kind of failure it was. */
function failureFor(status, body, model) {
  const detail = detailFrom(body);
  const suffix = detail ? ` (${detail})` : '';
  if (status === 401 || status === 403) {
    return llmError(
      'LLM_AUTH',
      `Hugging Face rejected the request (HTTP ${status}). Check that HF_TOKEN is valid and has the "Make calls to Inference Providers" permission.${suffix}`,
    );
  }
  if (status === 402) {
    return llmError(
      'LLM_RATE_LIMITED',
      'Hugging Face reports the free monthly credits are used up (HTTP 402). Add credits, wait for the monthly reset, or set LLM_PROVIDER=gemini.',
    );
  }
  if (status === 429) {
    return llmError('LLM_RATE_LIMITED', `Hugging Face rate limit reached (HTTP 429). Wait a moment and try again.${suffix}`);
  }
  if (status === 404) {
    return llmError('LLM_PROVIDER_ERROR', `Hugging Face could not find or serve the model "${model}" (HTTP 404). Check HF_MODEL.${suffix}`);
  }
  return llmError('LLM_PROVIDER_ERROR', `Hugging Face returned HTTP ${status}.${suffix}`);
}

/** One POST with a hard timeout that also covers reading the body. Never throws for an HTTP error status. */
async function post(url, token, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    let data = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      /* not JSON (an HTML error page, say): keep the text for the error detail */
    }
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    if (err?.name === 'AbortError') {
      const seconds = Math.max(1, Math.round(timeoutMs / 1000));
      throw llmError(
        'LLM_TIMEOUT',
        `Hugging Face did not answer within ${seconds} second${seconds === 1 ? '' : 's'}. The model may be cold-starting; try again, or raise HF_TIMEOUT_MS.`,
      );
    }
    throw llmError('LLM_PROVIDER_ERROR', `Could not reach Hugging Face (${err?.message || 'network error'}).`);
  } finally {
    clearTimeout(timer);
  }
}

function contentOf(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
  return '';
}

/**
 * Calls the chat completions endpoint once and returns the model's raw text.
 * @param {string} prompt Full prompt text.
 * @param {object} [responseSchema] The app's (Gemini-dialect) schema; described in the prompt and used to request JSON mode.
 * @returns {Promise<string>}
 */
export async function generateWithHuggingFace(prompt, responseSchema) {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) {
    throw llmError('LLM_NOT_CONFIGURED', 'HF_TOKEN is not configured on the server. It is required to use the Hugging Face provider.');
  }
  const model = process.env.HF_MODEL?.trim() || DEFAULT_HF_MODEL;
  const baseUrl = (process.env.HF_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const timeoutMs = positiveNumberFromEnv('HF_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildHuggingFacePrompt(prompt, responseSchema) },
    ],
    temperature: TEMPERATURE,
    max_tokens: positiveNumberFromEnv('HF_MAX_TOKENS', DEFAULT_MAX_TOKENS),
    stream: false,
  };

  // JSON mode is provider-dependent. Ask for it, and if the provider says the request is
  // malformed (400/422), send it once more without `response_format`: the prompt still has the schema.
  let result = await post(url, token, responseSchema ? { ...body, response_format: { type: 'json_object' } } : body, timeoutMs);
  if (!result.ok && responseSchema && (result.status === 400 || result.status === 422)) {
    result = await post(url, token, body, timeoutMs);
  }
  if (!result.ok) throw failureFor(result.status, result.data, model);

  const text = contentOf(result.data);
  if (!text.trim()) throw llmError('LLM_EMPTY_RESPONSE', 'Hugging Face returned an empty response.');
  return text;
}
