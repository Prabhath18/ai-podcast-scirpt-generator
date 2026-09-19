import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';

describe('auth routes', () => {
  let app;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('signs up a new user and sets a session cookie', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'new@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@example.com' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/podcast_session=/);
  });

  it('rejects signup with an invalid email', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects signup with a short password', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'dupe@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/signup').send({ email: 'dupe@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'login@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@example.com');
  });

  it('rejects an incorrect password without revealing whether the email exists', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'login2@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login2@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');

    const resUnknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(resUnknown.status).toBe(401);
    expect(resUnknown.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects /me with no session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('allows /me with a valid session and blocks it after logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'session@example.com', password: 'password123' });

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('session@example.com');

    await agent.post('/api/auth/logout');
    const meAfterLogout = await agent.get('/api/auth/me');
    expect(meAfterLogout.status).toBe(401);
  });

  it('lowercases email on signup so login is case-insensitive', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'MixedCase@Example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'mixedcase@example.com', password: 'password123' });
    expect(res.status).toBe(200);
  });
});
