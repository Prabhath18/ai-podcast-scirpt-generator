import rateLimit from 'express-rate-limit';

function jsonRateLimitHandler(_req, res) {
  res.status(429).json({
    error: 'Too many requests. Please wait a moment and try again.',
    code: 'RATE_LIMITED',
  });
}

// All three limiters share one in-memory store per process. The test suite
// runs many requests from the same IP (127.0.0.1) across files that may
// share a worker, which would otherwise trip these limits and produce
// flaky, environment-dependent failures unrelated to what's being tested --
// so rate limiting is disabled under NODE_ENV=test and exercised instead by
// calling the limiter middleware directly (see tests/rateLimiter.test.js).
const skipInTests = () => process.env.NODE_ENV === 'test';

// General per-IP ceiling for everyday API traffic (projects list, auth/me...).
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: jsonRateLimitHandler,
});

// LLM-backed endpoints are the expensive ones (real API cost + latency), so
// they get a tighter per-IP ceiling than general traffic.
export const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: jsonRateLimitHandler,
});

// Login/signup get the strictest limit to slow down credential stuffing /
// brute force attempts.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: jsonRateLimitHandler,
});
