import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

// The real limiters skip enforcement under NODE_ENV=test (see
// middleware/rateLimiter.js) so the rest of the suite isn't flaky. This
// file is the one place that flips NODE_ENV back on to prove the limiter
// itself actually blocks excess requests, then restores it.
describe('rate limiting', () => {
  let previousEnv;

  beforeAll(() => {
    previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it('returns 429 with the standard error shape once the auth limiter is exceeded', async () => {
    // Re-import after flipping NODE_ENV so the module reads the new value
    // (the limiter's `skip` callback reads process.env.NODE_ENV lazily per
    // request, so a fresh app instance is enough -- no need to reset modules).
    const { authLimiter } = await import('../middleware/rateLimiter.js');
    const app = express();
    app.use('/test', authLimiter, (_req, res) => res.json({ ok: true }));

    let lastResponse;
    for (let i = 0; i < 11; i++) {
      // eslint-disable-next-line no-await-in-loop -- requests must be sequential to hit the same counter
      lastResponse = await request(app).post('/test');
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body).toEqual({ error: expect.any(String), code: 'RATE_LIMITED' });
  });
});
