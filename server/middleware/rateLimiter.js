import rateLimit from 'express-rate-limit';
import { createRedisBackend, ResilientStore } from './rateLimitStore.js';
import { logger as defaultLogger } from '../utils/logger.js';

function jsonRateLimitHandler(_req, res) {
  res.status(429).json({
    error: 'Too many requests. Please wait a moment and try again.',
    code: 'RATE_LIMITED',
  });
}

// The test suite runs many requests from the same IP (127.0.0.1) across files that may
// share a worker, which would otherwise trip these limits and produce
// flaky, environment-dependent failures unrelated to what's being tested --
// so rate limiting is disabled under NODE_ENV=test and exercised instead by
// calling the limiter middleware directly (see tests/rateLimiter.test.js).
const skipInTests = () => process.env.NODE_ENV === 'test';

// name -> { window, limit, why }. `name` also prefixes the Redis keys ("rl:llm:<ip>").
const LIMITS = {
  // General per-IP ceiling for everyday API traffic (projects list, auth/me...).
  general: { windowMs: 60 * 1000, limit: 100 },
  // LLM-backed endpoints are the expensive ones (real API cost + latency), so
  // they get a tighter per-IP ceiling than general traffic.
  llm: { windowMs: 60 * 1000, limit: 12 },
  // Login/signup get the strictest limit to slow down credential stuffing /
  // brute force attempts.
  auth: { windowMs: 15 * 60 * 1000, limit: 10 },
  // Research proxies to Wikipedia/NewsAPI, which are cheap but not free of
  // limits (NewsAPI's free tier is tiny), so it gets its own ceiling.
  research: { windowMs: 60 * 1000, limit: 20 },
  // Posting comments is the only write a non-owner can make, so it is capped
  // tighter than general traffic to blunt spam on a public share link.
  commentWrite: { windowMs: 60 * 1000, limit: 15 },
};

/**
 * Builds every limiter. With REDIS_URL set, all of them count in Redis (shared across server
 * instances, with an automatic in-memory fallback if Redis is unreachable); without it they use
 * express-rate-limit's in-memory store, exactly as before. Redis is never used under NODE_ENV=test.
 *
 * A factory rather than module-level constants so tests can supply a fake Redis client.
 *
 * @param {object} [options]
 * @param {object} [options.env] defaults to process.env
 * @param {(url: string) => object} [options.createClient] builds the Redis client (default: ioredis)
 * @param {() => boolean} [options.skip] requests to leave uncounted (default: everything under NODE_ENV=test)
 */
export function createRateLimiters({ env = process.env, createClient, skip = skipInTests, logger = defaultLogger } = {}) {
  const url = env.REDIS_URL?.trim();
  const useRedis = Boolean(url) && env.NODE_ENV !== 'test';
  const backend = useRedis ? createRedisBackend({ url, createClient, logger }) : null;
  const stores = {};

  const build = (name) => {
    const { windowMs, limit } = LIMITS[name];
    if (backend) stores[name] = new ResilientStore({ backend, prefix: `rl:${name}:` });
    return rateLimit({
      windowMs,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      skip,
      handler: jsonRateLimitHandler,
      ...(backend ? { store: stores[name] } : {}),
    });
  };

  return {
    generalLimiter: build('general'),
    llmLimiter: build('llm'),
    authLimiter: build('auth'),
    researchLimiter: build('research'),
    commentWriteLimiter: build('commentWrite'),
    stores,
    /** { store: 'redis' | 'memory', configured, connected } for the startup log. */
    status: () => (backend ? { store: backend.status().connected ? 'redis' : 'memory', ...backend.status() } : { store: 'memory', configured: false, connected: false }),
    close: () => backend?.close(),
  };
}

const defaults = createRateLimiters();

export const generalLimiter = defaults.generalLimiter;
export const llmLimiter = defaults.llmLimiter;
export const authLimiter = defaults.authLimiter;
export const researchLimiter = defaults.researchLimiter;
export const commentWriteLimiter = defaults.commentWriteLimiter;
export const rateLimitStatus = defaults.status;
