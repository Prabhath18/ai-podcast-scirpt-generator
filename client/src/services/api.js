// Single fetch wrapper for every backend call. In dev, Vite proxies /api to
// the Express server (see vite.config.js) so the base URL can stay empty;
// in production, set VITE_API_BASE_URL to the deployed API's origin.
import { readSse } from './sse.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(message, code, details, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

/**
 * A stream that could not be used (no streaming support, the connection dropped, the server does not have
 * the streaming route). Distinct from ApiError, which is an answer the server chose to give: a StreamFailure
 * means "try the ordinary request instead", an ApiError means "the request itself failed".
 */
export class StreamFailure extends Error {
  constructor(message) {
    super(message);
    this.name = 'StreamFailure';
  }
}

/** Whether this browser can read a streamed response body at all. */
export const streamingSupported = () =>
  typeof fetch === 'function' && typeof ReadableStream !== 'undefined' && typeof TextDecoder !== 'undefined';

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 'NETWORK_ERROR');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error || `Request failed with status ${response.status}.`,
      payload?.code || 'UNKNOWN_ERROR',
      payload?.details,
      response.status,
    );
  }
  return payload;
}

/**
 * POSTs to a Server-Sent Events endpoint (the streaming variant of a generation route) and resolves with
 * the payload of its final `result` event. Every other event is passed to `onEvent(name, data)` as it
 * arrives. Rejects with an ApiError for an answer the server chose to give (a validation error, a rate
 * limit, an `error` event) and with a StreamFailure when the stream itself could not be used.
 * An aborted `signal` rejects with the browser's AbortError.
 */
async function streamRequest(path, body, { onEvent, signal } = {}) {
  if (!streamingSupported()) throw new StreamFailure('Streaming is not supported in this browser.');

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new StreamFailure('Could not open the stream.');
  }

  const isStream = response.headers.get('content-type')?.includes('text/event-stream');
  if (!response.ok || !isStream || !response.body) {
    // An ordinary answer instead of a stream: the server refused the request before streaming
    // (validation, rate limit) or is not our API at all (an old server, a proxy error page).
    const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json().catch(() => null) : null;
    if (response.ok) throw new StreamFailure('The server did not answer with a stream.');
    throw new ApiError(payload?.error || `Request failed with status ${response.status}.`, payload?.code || 'UNKNOWN_ERROR', payload?.details, response.status);
  }

  let result = null;
  let serverError = null;
  try {
    await readSse(response.body, ({ event, data }) => {
      let payload = null;
      try {
        payload = JSON.parse(data);
      } catch {
        return; // a malformed event is skipped; a missing result is caught below
      }
      if (event === 'result') result = payload;
      else if (event === 'error') serverError = payload;
      else onEvent?.(event, payload);
      return event === 'result' || event === 'error'; // the last event: do not wait for the server to close the connection
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new StreamFailure('The stream was interrupted.');
  }

  if (serverError) throw new ApiError(serverError.error || 'Generation failed.', serverError.code || 'UNKNOWN_ERROR', serverError.details, 200);
  if (!result) throw new StreamFailure('The stream ended before the result arrived.');
  return result;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  stream: streamRequest,
};
