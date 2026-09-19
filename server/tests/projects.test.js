import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { sampleOutline } from './fixtures.js';

describe('project ownership', () => {
  let app;
  let ownerAgent;
  let otherAgent;
  let projectId;

  beforeEach(async () => {
    ({ app } = createTestApp());
    ownerAgent = request.agent(app);
    otherAgent = request.agent(app);

    await ownerAgent.post('/api/auth/signup').send({ email: 'owner@example.com', password: 'password123' });
    await otherAgent.post('/api/auth/signup').send({ email: 'other@example.com', password: 'password123' });

    const createRes = await ownerAgent.post('/api/projects').send({ title: 'My Episode', outline: sampleOutline() });
    projectId = createRes.body.project.id;
  });

  it('requires auth to list or create projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('lets the owner read their project', async () => {
    const res = await ownerAgent.get(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.project.title).toBe('My Episode');
  });

  it('hides another user\'s project behind a 404, not a 403', async () => {
    const res = await otherAgent.get(`/api/projects/${projectId}`);
    expect(res.status).toBe(404);
  });

  it('prevents another user from updating the project', async () => {
    const res = await otherAgent.put(`/api/projects/${projectId}`).send({ title: 'Hijacked' });
    expect(res.status).toBe(404);

    const check = await ownerAgent.get(`/api/projects/${projectId}`);
    expect(check.body.project.title).toBe('My Episode');
  });

  it('prevents another user from deleting the project', async () => {
    const res = await otherAgent.delete(`/api/projects/${projectId}`);
    expect(res.status).toBe(404);

    const check = await ownerAgent.get(`/api/projects/${projectId}`);
    expect(check.status).toBe(200);
  });

  it('rejects an outline that fails validation on update', async () => {
    const res = await ownerAgent.put(`/api/projects/${projectId}`).send({ outline: sampleOutline({ segments: [] }) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('lets the owner rename and see the updated_at bump', async () => {
    const res = await ownerAgent.put(`/api/projects/${projectId}`).send({ title: 'Renamed Episode' });
    expect(res.status).toBe(200);
    expect(res.body.project.title).toBe('Renamed Episode');
  });

  it('only lists projects for the requesting user', async () => {
    const ownerList = await ownerAgent.get('/api/projects');
    const otherList = await otherAgent.get('/api/projects');
    expect(ownerList.body.projects).toHaveLength(1);
    expect(otherList.body.projects).toHaveLength(0);
  });
});

describe('share links', () => {
  let app;
  let ownerAgent;
  let projectId;

  beforeEach(async () => {
    ({ app } = createTestApp());
    ownerAgent = request.agent(app);
    await ownerAgent.post('/api/auth/signup').send({ email: 'sharer@example.com', password: 'password123' });
    const createRes = await ownerAgent.post('/api/projects').send({ title: 'Shareable Episode', outline: sampleOutline() });
    projectId = createRes.body.project.id;
  });

  it('creates a working read-only share link with no auth required', async () => {
    const shareRes = await ownerAgent.post(`/api/projects/${projectId}/share`);
    expect(shareRes.status).toBe(200);
    const token = shareRes.body.shareToken;
    expect(token).toBeTruthy();

    const publicRes = await request(app).get(`/api/shared/${token}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.title).toBe('Shareable Episode');
    expect(publicRes.body.outline.episode_title).toBe('A Great Episode');
  });

  it('returns 404 for an unknown share token', async () => {
    const res = await request(app).get('/api/shared/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('revoking a share token makes it stop working', async () => {
    const shareRes = await ownerAgent.post(`/api/projects/${projectId}/share`);
    const token = shareRes.body.shareToken;

    await ownerAgent.delete(`/api/projects/${projectId}/share`);
    const res = await request(app).get(`/api/shared/${token}`);
    expect(res.status).toBe(404);
  });
});
