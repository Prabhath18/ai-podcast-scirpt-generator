// One error shape for the whole API: { error, code }. Route handlers throw
// or call next(err); this is the single place that turns that into a
// response, so every unhandled promise rejection still gets a clean JSON
// reply instead of Express's default HTML stack trace.
import { logger } from '../utils/logger.js';

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  COMMENTS_DISABLED: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  RATE_LIMITED: 429,
  LLM_NOT_CONFIGURED: 503,
  LLM_INVALID_RESPONSE: 502,
  LLM_EMPTY_RESPONSE: 502,
  LLM_PROVIDER_ERROR: 502,
  LLM_AUTH: 502,
  LLM_RATE_LIMITED: 429,
  LLM_TIMEOUT: 504,
};

/** Wraps an async Express handler so rejected promises reach the error middleware. */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Not found.', code: 'NOT_FOUND' });
}

/** The HTTP status and the { error, code } body for an error. Shared with the SSE route, which reports errors as an event. */
export function toErrorResponse(err) {
  const code = err.code || 'INTERNAL_ERROR';
  const status = err.status || STATUS_BY_CODE[code] || 500;
  const body = { error: err.publicMessage || err.message || 'Something went wrong.', code };
  if (err.details) body.details = err.details;
  return { status, body };
}

/** Logs an error that ends a request as a server failure (5xx). Client errors (4xx) show up in the access log. */
export function logRequestError(err, { reqId, method, path, status, code }) {
  if (status >= 500) logger.error({ err, reqId, method, path, status, code }, 'request failed');
}

// eslint-disable-next-line no-unused-vars -- Express requires 4 args to identify error middleware
export function errorHandler(err, req, res, _next) {
  const { status, body } = toErrorResponse(err);
  logRequestError(err, { reqId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status, code: body.code });
  res.status(status).json(body);
}
