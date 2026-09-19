import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { clearCache } from '../utils/memoryCache.js';

vi.mock('../services/llm.js', () => ({
  generate: vi.fn(),
  GEMINI_MODEL: 'gemini-2.5-flash-test',
}));

import { generate } from '../services/llm.js';

describe('POST /api/guest-questions', () => {
  let app;

  beforeEach(() => {
    ({ app } = createTestApp());
    generate.mockReset();
    clearCache();
  });

  const payload = { topic: 'AI in education', tone: 'Educational', guestNames: 'Dr. Rivera', guestBio: 'Education researcher' };

  it('returns a list of questions from the LLM', async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ questions: ['Q1?', 'Q2?', 'Q3?'] }));
    const res = await request(app).post('/api/guest-questions').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
  });

  it('caches identical requests so a repeat does not call the LLM again', async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ questions: ['Q1?', 'Q2?'] }));
    await request(app).post('/api/guest-questions').send(payload);
    const second = await request(app).post('/api/guest-questions').send(payload);
    expect(second.body.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('rejects a request missing topic/tone', async () => {
    const res = await request(app).post('/api/guest-questions').send({ guestNames: 'Dr. Rivera' });
    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns 502 if the LLM response is malformed after a retry', async () => {
    generate.mockResolvedValue(JSON.stringify({ notQuestions: [] }));
    const res = await request(app).post('/api/guest-questions').send(payload);
    expect(res.status).toBe(502);
  });
});
