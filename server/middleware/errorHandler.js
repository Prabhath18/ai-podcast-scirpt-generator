// One error shape for the whole API: { error, code }. Route handlers throw
// or call next(err); this is the single place that turns that into a
// response, so every unhandled promise rejection still gets a clean JSON
// reply instead of Express's default HTML stack trace.

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

// eslint-disable-next-line no-unused-vars -- Express requires 4 args to identify error middleware
export function errorHandler(err, req, res, _next) {
  const code = err.code || 'INTERNAL_ERROR';
  const status = err.status || STATUS_BY_CODE[code] || 500;

  if (status >= 500) {
    // eslint-disable-next-line no-console -- intentional server-side error log
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }

  const body = { error: err.publicMessage || err.message || 'Something went wrong.', code };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
}
