import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { sampleOutline } from './fixtures.js';
import { clearCache } from '../utils/memoryCache.js';

vi.mock('../services/llm.js', () => ({
  generate: vi.fn(),
  GEMINI_MODEL: 'gemini-2.5-flash-test',
}));

import { generate } from '../services/llm.js';

function deepDivePayload(note = 'Some research notes.') {
  return JSON.stringify({ notes: `${note}\n\nSecond paragraph.`, discussion_prompts: ['Prompt one?', 'Prompt two?'] });
}

describe('POST /api/expand-segment', () => {
  let app;

  beforeEach(() => {
    ({ app } = createTestApp());
    generate.mockReset();
    clearCache();
  });

  const baseRequest = (overrides = {}) => ({
    topic: 'AI in education',
    tone: 'Educational',
    lengthMins: 30,
    outline: sampleOutline(),
    segment: sampleOutline().segments[0],
    ...overrides,
  });

  it('generates and returns Deep Dive notes for an anonymous (no project) request', async () => {
    generate.mockResolvedValueOnce(deepDivePayload());
    const res = await request(app).post('/api/expand-segment').send(baseRequest());
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.deepDive.discussion_prompts).toHaveLength(2);
  });

  it('serves the second identical anonymous request from the in-memory cache', async () => {
    generate.mockResolvedValueOnce(deepDivePayload());
    await request(app).post('/api/expand-segment').send(baseRequest());
    const second = await request(app).post('/api/expand-segment').send(baseRequest());
    expect(second.body.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('persists Deep Dive results in the DB cache when a projectId is owned by the caller', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'deepdive@example.com', password: 'password123' });
    const outline = sampleOutline();
    const createRes = await agent.post('/api/projects').send({ title: 'DD Project', outline });
    const projectId = createRes.body.project.id;

    generate.mockResolvedValueOnce(deepDivePayload('First notes.'));
    const first = await agent.post('/api/expand-segment').send(baseRequest({ outline, segment: outline.segments[0], projectId }));
    expect(first.body.cached).toBe(false);

    const second = await agent.post('/api/expand-segment').send(baseRequest({ outline, segment: outline.segments[0], projectId }));
    expect(second.body.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('marks the project cache stale after the segment is edited, forcing a fresh call', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'stale@example.com', password: 'password123' });
    const outline = sampleOutline();
    const createRes = await agent.post('/api/projects').send({ title: 'Stale Project', outline });
    const projectId = createRes.body.project.id;

    generate.mockResolvedValueOnce(deepDivePayload('Original notes.'));
    await agent.post('/api/expand-segment').send(baseRequest({ outline, segment: outline.segments[0], projectId }));

    const editedOutline = {
      ...outline,
      segments: outline.segments.map((s, i) => (i === 0 ? { ...s, title: 'A Brand New Title' } : s)),
    };
    const updateRes = await agent.put(`/api/projects/${projectId}`).send({ outline: editedOutline });
    expect(updateRes.status).toBe(200);

    generate.mockResolvedValueOnce(deepDivePayload('Fresh notes after edit.'));
    const afterEdit = await agent
      .post('/api/expand-segment')
      .send(baseRequest({ outline: editedOutline, segment: editedOutline.segments[0], projectId }));

    expect(afterEdit.body.cached).toBe(false);
    expect(afterEdit.body.deepDive.notes).toContain('Fresh notes after edit.');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('ignores a projectId the caller does not own and falls back to the anonymous cache', async () => {
    const ownerAgent = request.agent(app);
    await ownerAgent.post('/api/auth/signup').send({ email: 'realowner@example.com', password: 'password123' });
    const outline = sampleOutline();
    const createRes = await ownerAgent.post('/api/projects').send({ title: 'Not Yours', outline });
    const projectId = createRes.body.project.id;

    generate.mockResolvedValueOnce(deepDivePayload());
    const res = await request(app)
      .post('/api/expand-segment')
      .send(baseRequest({ outline, segment: outline.segments[0], projectId }));

    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
