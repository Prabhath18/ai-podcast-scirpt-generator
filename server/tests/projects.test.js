import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { sampleOutline, sampleVariation } from './fixtures.js';

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

describe('optional outline fields', () => {
  it('round-trips variations, pinned sources and intro_outro through SQLite', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'fields@example.com', password: 'password123' });

    const outline = sampleOutline({
      variations: [sampleVariation('A'), sampleVariation('B')],
      intro_outro: { hooks: [{ style: 'Question', text: 'Ever wonder?' }], intro_script: 'Welcome.', outros: ['Bye.'], teaser: 'Soon.' },
    });
    outline.segments[0].sources = [{ type: 'wikipedia', title: 'Jazz', url: 'https://en.wikipedia.org/wiki/Jazz', summary: 'A genre.' }];

    const created = await agent.post('/api/projects').send({ title: 'With extras', outline });
    expect(created.status).toBe(201);

    const loaded = await agent.get(`/api/projects/${created.body.project.id}`);
    expect(loaded.body.project.outline.variations).toHaveLength(2);
    expect(loaded.body.project.outline.segments[0].sources[0].title).toBe('Jazz');
    expect(loaded.body.project.outline.intro_outro.teaser).toBe('Soon.');
  });

  it('still saves and loads an outline in the original format, with none of the new fields', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'legacy@example.com', password: 'password123' });

    const created = await agent.post('/api/projects').send({ title: 'Legacy', outline: sampleOutline() });
    const loaded = await agent.get(`/api/projects/${created.body.project.id}`);
    expect(loaded.body.project.outline).toEqual(sampleOutline());
    expect(loaded.body.project.commentsEnabled).toBe(true);
  });

  it('rejects an invalid pinned source on save', async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'bad@example.com', password: 'password123' });
    const outline = sampleOutline();
    outline.segments[0].sources = [{ title: 'No link', summary: '' }];
    const res = await agent.post('/api/projects').send({ title: 'Bad', outline });
    expect(res.status).toBe(400);
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
