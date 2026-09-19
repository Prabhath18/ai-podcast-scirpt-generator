import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { sampleOutline, sampleVariation, rawVariation } from './fixtures.js';
import { validateOutline, validateVariation } from '../validators/outlineSchema.js';
import { validateVariationsRequest } from '../validators/requestValidators.js';

vi.mock('../services/llm.js', () => ({ generate: vi.fn(), GEMINI_MODEL: 'test-model' }));
import { generate } from '../services/llm.js';

describe('validateVariation', () => {
  it('accepts an approach, rationale and a complete outline', () => {
    expect(validateVariation(sampleVariation()).valid).toBe(true);
  });

  it('rejects a missing approach label', () => {
    const result = validateVariation(sampleVariation('  '));
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('approach');
  });

  it('reports errors from the nested outline with a prefixed field', () => {
    const bad = sampleVariation('Debate', { outline: sampleOutline({ segments: [] }) });
    const result = validateVariation(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'outline.segments')).toBe(true);
  });

  it('forbids a variation from nesting its own variations', () => {
    const nested = sampleVariation('Debate', { outline: sampleOutline({ variations: [sampleVariation()] }) });
    expect(validateVariation(nested).valid).toBe(false);
  });
});

describe('outline with stored variations', () => {
  it('stays valid without the optional fields (backward compatible)', () => {
    expect(validateOutline(sampleOutline()).valid).toBe(true);
  });

  it('accepts up to three valid variations', () => {
    const outline = sampleOutline({ variations: [sampleVariation('A'), sampleVariation('B'), sampleVariation('C')] });
    expect(validateOutline(outline).valid).toBe(true);
  });

  it('rejects a fourth variation', () => {
    const outline = sampleOutline({ variations: ['A', 'B', 'C', 'D'].map((a) => sampleVariation(a)) });
    expect(validateOutline(outline).valid).toBe(false);
  });

  it('rejects a variation whose outline is invalid', () => {
    const outline = sampleOutline({ variations: [sampleVariation('A', { outline: { episode_title: 'x' } })] });
    expect(validateOutline(outline).valid).toBe(false);
  });
});

describe('pinned sources on a segment', () => {
  const withSources = (sources) => {
    const outline = sampleOutline();
    outline.segments[0].sources = sources;
    return outline;
  };
  const source = { type: 'wikipedia', title: 'Jazz', url: 'https://en.wikipedia.org/wiki/Jazz', summary: 'A genre.' };

  it('accepts sources with a title, http(s) url and summary', () => {
    expect(validateOutline(withSources([source])).valid).toBe(true);
  });

  it('rejects a non-http url', () => {
    expect(validateOutline(withSources([{ ...source, url: 'javascript:alert(1)' }])).valid).toBe(false);
  });

  it('rejects more than ten sources on one segment', () => {
    expect(validateOutline(withSources(Array.from({ length: 11 }, () => source))).valid).toBe(false);
  });
});

describe('validateVariationsRequest', () => {
  const base = { topic: 'Jazz', tone: 'Educational', lengthMins: 30, hostCount: 'solo' };

  it('requires count to be 2 or 3', () => {
    expect(validateVariationsRequest({ ...base, count: 2 }).valid).toBe(true);
    expect(validateVariationsRequest({ ...base, count: 3 }).valid).toBe(true);
    expect(validateVariationsRequest({ ...base, count: 4 }).valid).toBe(false);
    expect(validateVariationsRequest({ ...base }).valid).toBe(false);
  });
});

describe('POST /api/generate-variations', () => {
  let app;
  const body = { topic: 'Jazz history', tone: 'Educational', lengthMins: 40, hostCount: 'solo', count: 3 };

  beforeEach(() => {
    ({ app } = createTestApp());
    generate.mockReset();
  });

  it('returns the requested number of variations with durations summing to the target', async () => {
    generate.mockResolvedValueOnce(
      JSON.stringify({ variations: [rawVariation('Chronological story'), rawVariation('Problem and solution'), rawVariation('Myth-busting')] }),
    );
    const res = await request(app).post('/api/generate-variations').send(body);

    expect(res.status).toBe(201);
    expect(res.body.skipped).toBe(0);
    expect(res.body.variations).toHaveLength(3);
    for (const variation of res.body.variations) {
      const total = variation.outline.segments.reduce((sum, s) => sum + s.duration_mins, 0);
      expect(total).toBe(40);
      expect(variation.outline.tone).toBe('Educational');
      expect(variation.outline.total_duration_mins).toBe(40);
    }
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('retries once when a variation is invalid and uses the corrected response', async () => {
    const broken = rawVariation('Problem and solution', { segments: [] });
    generate
      .mockResolvedValueOnce(JSON.stringify({ variations: [rawVariation('Chronological story'), broken] }))
      .mockResolvedValueOnce(JSON.stringify({ variations: [rawVariation('Chronological story'), rawVariation('Problem and solution')] }));

    const res = await request(app).post('/api/generate-variations').send({ ...body, count: 2 });
    expect(res.status).toBe(201);
    expect(res.body.variations).toHaveLength(2);
    expect(res.body.skipped).toBe(0);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('returns the valid variations and reports skipped ones when the retry is still partly invalid', async () => {
    const broken = rawVariation('Problem and solution', { segments: [] });
    generate.mockResolvedValue(JSON.stringify({ variations: [rawVariation('Chronological story'), broken] }));

    const res = await request(app).post('/api/generate-variations').send({ ...body, count: 2 });
    expect(res.status).toBe(201);
    expect(res.body.variations).toHaveLength(1);
    expect(res.body.variations[0].approach).toBe('Chronological story');
    expect(res.body.skipped).toBe(1);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('treats a repeated approach as invalid so variations stay structurally different', async () => {
    generate.mockResolvedValue(JSON.stringify({ variations: [rawVariation('Story'), rawVariation('story')] }));
    const res = await request(app).post('/api/generate-variations').send({ ...body, count: 2 });
    expect(res.status).toBe(201);
    expect(res.body.variations).toHaveLength(1);
    expect(res.body.skipped).toBe(1);
  });

  it('returns 502 when nothing valid comes back after the retry', async () => {
    generate.mockResolvedValue('not json');
    const res = await request(app).post('/api/generate-variations').send(body);
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_INVALID_RESPONSE');
  });

  it('rejects a bad count without calling the LLM', async () => {
    const res = await request(app).post('/api/generate-variations').send({ ...body, count: 9 });
    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
});
