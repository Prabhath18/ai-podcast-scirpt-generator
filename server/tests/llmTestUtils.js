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

// --- Streaming ---------------------------------------------------------------------------------

/** One streamed chat-completion chunk, as a Server-Sent Events frame. */
export const hfDelta = (content) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`;

export const HF_DONE = 'data: [DONE]\n\n';

/**
 * A fetch that answers with a streamed body made of `pieces`, in order. Each piece is a string (sent as
 * one network chunk, so a piece may end mid-line), a number (wait that many ms), or an Error (the
 * connection breaks). `stall` leaves the stream open at the end, like a model that stopped talking.
 * Aborting the request's signal errors the stream, as a real fetch does.
 */
export const streamingFetch = (pieces, { stall = false, status = 200 } = {}) =>
  vi.fn((_url, { signal } = {}) => {
    // Like the real fetch: a request whose signal has already been aborted never starts.
    if (signal?.aborted) return Promise.reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
    const encoder = new TextEncoder();
    let cancelled = false;
    const body = new ReadableStream({
      async start(controller) {
        signal?.addEventListener('abort', () => {
          cancelled = true;
          try {
            controller.error(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
          } catch {
            /* already closed */
          }
        });
        for (const piece of pieces) {
          if (cancelled) return;
          if (typeof piece === 'number') {
            // eslint-disable-next-line no-await-in-loop -- a scripted delay between chunks
            await new Promise((resolve) => setTimeout(resolve, piece));
          } else if (piece instanceof Error) {
            controller.error(piece);
            return;
          } else {
            controller.enqueue(encoder.encode(piece));
          }
        }
        if (!stall && !cancelled) controller.close();
      },
    });
    return Promise.resolve(new Response(body, { status, headers: { 'content-type': 'text/event-stream' } }));
  });
