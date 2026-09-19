import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { sampleOutline } from './fixtures.js';
import { HOOK_STYLES, validateGeneratedIntroOutro, validateIntroOutro } from '../validators/introOutroSchema.js';
import { validateOutline } from '../validators/outlineSchema.js';

vi.mock('../services/llm.js', () => ({ generate: vi.fn(), GEMINI_MODEL: 'test-model' }));
import { generate } from '../services/llm.js';

function fakeIntroOutro(overrides = {}) {
  return {
    hooks: HOOK_STYLES.map((style) => ({ style, text: `A ${style} hook.` })),
    intro_script: 'Welcome to the show. Today we look at how it all began.',
    outros: ['Thanks for listening.', 'See you next week.', 'Subscribe and share.'],
    teaser: 'How it all began.',
    ...overrides,
  };
}

describe('validateGeneratedIntroOutro', () => {
  it('accepts five hooks (one per style), three outros, a script and a teaser', () => {
    expect(validateGeneratedIntroOutro(fakeIntroOutro(), 'solo').valid).toBe(true);
  });

  it('rejects a missing hook style', () => {
    const data = fakeIntroOutro({ hooks: fakeIntroOutro().hooks.slice(0, 4) });
    expect(validateGeneratedIntroOutro(data, 'solo').valid).toBe(false);
  });

  it('rejects two hooks of the same style', () => {
    const hooks = fakeIntroOutro().hooks.map((h, i) => (i === 4 ? { ...h, style: 'Question' } : h));
    expect(validateGeneratedIntroOutro(fakeIntroOutro({ hooks }), 'solo').valid).toBe(false);
  });

  it('requires exactly three non-empty outros', () => {
    expect(validateGeneratedIntroOutro(fakeIntroOutro({ outros: ['one', 'two'] }), 'solo').valid).toBe(false);
    expect(validateGeneratedIntroOutro(fakeIntroOutro({ outros: ['one', 'two', ' '] }), 'solo').valid).toBe(false);
  });

  it('keeps a solo intro to one voice', () => {
    const labelled = fakeIntroOutro({ intro_script: 'Host 1: Hello.\nHost 2: Hi.' });
    expect(validateGeneratedIntroOutro(labelled, 'solo').valid).toBe(false);
  });

  it('requires Host 1 and Host 2 turns for duo and group', () => {
    const labelled = fakeIntroOutro({ intro_script: 'Host 1: Hello.\nHost 2: Hi there.' });
    expect(validateGeneratedIntroOutro(labelled, 'duo').valid).toBe(true);
    expect(validateGeneratedIntroOutro(labelled, 'group').valid).toBe(true);
    expect(validateGeneratedIntroOutro(fakeIntroOutro(), 'duo').valid).toBe(false);
  });
});

describe('stored intro_outro on an outline', () => {
  it('is optional', () => {
    expect(validateOutline(sampleOutline()).valid).toBe(true);
  });

  it('accepts a generated set and tolerates emptied text boxes after inline edits', () => {
    const edited = fakeIntroOutro({ teaser: '', outros: ['', 'x', 'y'] });
    expect(validateIntroOutro(edited).valid).toBe(true);
    expect(validateOutline(sampleOutline({ intro_outro: edited })).valid).toBe(true);
  });

  it('rejects an unknown hook style', () => {
    const bad = fakeIntroOutro({ hooks: [{ style: 'Riddle', text: 'x' }] });
    expect(validateOutline(sampleOutline({ intro_outro: bad })).valid).toBe(false);
  });
});

describe('POST /api/intro-outro', () => {
  let app;
  const body = { topic: 'Jazz', tone: 'Educational', hostCount: 'duo', lengthMins: 30, outline: sampleOutline() };

  beforeEach(() => {
    ({ app } = createTestApp());
    generate.mockReset();
  });

  it('returns validated hooks, intro script, outros and teaser', async () => {
    generate.mockResolvedValueOnce(JSON.stringify(fakeIntroOutro({ intro_script: 'Host 1: Hi.\nHost 2: Hello.' })));
    const res = await request(app).post('/api/intro-outro').send(body);
    expect(res.status).toBe(200);
    expect(res.body.introOutro.hooks).toHaveLength(5);
    expect(res.body.introOutro.outros).toHaveLength(3);
  });

  it('retries once when a duo script has no speaker labels', async () => {
    generate
      .mockResolvedValueOnce(JSON.stringify(fakeIntroOutro()))
      .mockResolvedValueOnce(JSON.stringify(fakeIntroOutro({ intro_script: 'Host 1: Hi.\nHost 2: Hello.' })));
    const res = await request(app).post('/api/intro-outro').send(body);
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('returns 502 if the response stays invalid', async () => {
    generate.mockResolvedValue(JSON.stringify({ hooks: [] }));
    const res = await request(app).post('/api/intro-outro').send(body);
    expect(res.status).toBe(502);
  });

  it('rejects a request without an outline', async () => {
    const res = await request(app).post('/api/intro-outro').send({ topic: 'Jazz', tone: 'Educational' });
    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
});
