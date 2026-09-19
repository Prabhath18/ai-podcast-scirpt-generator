import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';

// Limiters are skipped under NODE_ENV=test; this file turns them back on to check
// WHICH auth routes they cover, then restores the environment.
describe('auth rate limiting covers credentials, not session checks', () => {
  let previousEnv;

  beforeAll(() => {
    previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it('lets /me and /logout be called far more than 10 times in a window', async () => {
    const { app } = createTestApp();
    for (let i = 0; i < 25; i++) {
      const me = await request(app).get('/api/auth/me');
      expect(me.status).toBe(401); // "not signed in", never 429
    }
    for (let i = 0; i < 12; i++) {
      expect((await request(app).post('/api/auth/logout')).status).toBe(204);
    }
  });

  it('still blocks repeated login attempts after 10, and signups share that budget', async () => {
    const { app } = createTestApp();
    const attempt = () => request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'wrong-password' });
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');

    // Login and signup are one limiter, so guessing passwords through signup is blocked too.
    const signup = await request(app).post('/api/auth/signup').send({ email: 'new@example.com', password: 'password123' });
    expect(signup.status).toBe(429);
  });
});
