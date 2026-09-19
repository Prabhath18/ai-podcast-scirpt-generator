import { vi } from 'vitest';

// Shared helpers for the provider tests: environment save/restore, and fake Hugging Face
// answers built from real Response objects, so no test touches the network.

const ENV_KEYS = [
  'LLM_PROVIDER',
  'LLM_FALLBACK_PROVIDER',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'HF_TOKEN',
  'HF_MODEL',
  'HF_BASE_URL',
  'HF_TIMEOUT_MS',
  'HF_MAX_TOKENS',
];

/** Call in beforeEach: clears every LLM variable and returns a function that restores the originals. */
export function isolateLlmEnv() {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  return () => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  };
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A successful chat completion whose message content is `content` (a string, or an array of parts). */
export const chatResponse = (content) => json(200, { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] });

/** An error answer in Hugging Face's shape. */
export const errorResponse = (status, message = 'Something went wrong.') => json(status, { error: message });

/** A fetch that never answers on its own but rejects with an AbortError when the caller's timeout fires. */
export const neverAnswers = () =>
  vi.fn(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })));
      }),
  );

/** The parsed JSON body of the nth fetch call. */
export const bodyOfCall = (fetchMock, n = 0) => JSON.parse(fetchMock.mock.calls[n][1].body);
