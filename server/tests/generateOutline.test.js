import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';

// Mocks the ONE module allowed to touch the Gemini SDK, so this integration
// test exercises the real route, validation, retry, and duration
// normalization logic without ever calling out to a real LLM.
vi.mock('../services/llm.js', () => ({
  generate: vi.fn(),
  GEMINI_MODEL: 'gemini-2.5-flash-test',
}));

import { generate } from '../services/llm.js';

function fakeOutline(overrides = {}) {
  return {
    episode_title: 'Mocked Episode',
    tone: 'Educational',
    total_duration_mins: 30,
    intro: 'Hi there.',
    segments: Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `Segment ${i + 1}`,
      talking_points: ['a', 'b', 'c'],
      duration_mins: 6,
      transition: 'next...',
    })),
    guest_questions: [],
    outro: 'Bye.',
    ...overrides,
  };
}

describe('POST /api/generate-outline', () => {
  let app;

  beforeEach(() => {
    ({ app } = createTestApp());
    generate.mockReset();
  });

  it('returns a validated, duration-normalized outline', async () => {
    generate.mockResolvedValueOnce(JSON.stringify(fakeOutline()));

    const res = await request(app)
      .post('/api/generate-outline')
      .send({ topic: 'AI in education', tone: 'Educational', lengthMins: 40, hostCount: 'solo' });

    expect(res.status).toBe(201);
    expect(res.body.outline.episode_title).toBe('Mocked Episode');
    expect(res.body.outline.segments).toHaveLength(5);
    const total = res.body.outline.segments.reduce((sum, seg) => sum + seg.duration_mins, 0);
    expect(total).toBe(40);
    expect(res.body.outline.total_duration_mins).toBe(40);
  });

  it('rejects a request with no topic', async () => {
    const res = await request(app).post('/api/generate-outline').send({ tone: 'Educational', lengthMins: 30 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects a length outside 5-180 minutes', async () => {
    const res = await request(app).post('/api/generate-outline').send({ topic: 'AI', tone: 'Educational', lengthMins: 500 });
    expect(res.status).toBe(400);
  });

  it('retries once when the LLM returns invalid JSON, then succeeds', async () => {
    generate.mockResolvedValueOnce('not json at all').mockResolvedValueOnce(JSON.stringify(fakeOutline()));

    const res = await request(app)
      .post('/api/generate-outline')
      .send({ topic: 'AI in education', tone: 'Educational', lengthMins: 30 });

    expect(res.status).toBe(201);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('returns 502 when the LLM keeps failing validation after a retry', async () => {
    generate.mockResolvedValue('still not json');

    const res = await request(app)
      .post('/api/generate-outline')
      .send({ topic: 'AI in education', tone: 'Educational', lengthMins: 30 });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_INVALID_RESPONSE');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('strips markdown code fences from the LLM response before parsing', async () => {
    generate.mockResolvedValueOnce('```json\n' + JSON.stringify(fakeOutline()) + '\n```');

    const res = await request(app)
      .post('/api/generate-outline')
      .send({ topic: 'AI in education', tone: 'Educational', lengthMins: 30 });

    expect(res.status).toBe(201);
  });
});
