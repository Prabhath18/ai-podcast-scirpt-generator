import { describe, it, expect } from 'vitest';
import { normalizeDurations, sumDurations } from '../utils/duration.js';

describe('normalizeDurations', () => {
  it('rescales segments so they sum exactly to the target', () => {
    const segments = [{ duration_mins: 10 }, { duration_mins: 10 }, { duration_mins: 10 }];
    const result = normalizeDurations(segments, 45);
    expect(sumDurations(result)).toBe(45);
    expect(result).toHaveLength(3);
  });

  it('keeps every segment at least 1 minute even for a short target', () => {
    const segments = Array.from({ length: 8 }, () => ({ duration_mins: 5 }));
    const result = normalizeDurations(segments, 8);
    expect(sumDurations(result)).toBe(8);
    expect(result.every((s) => s.duration_mins >= 1)).toBe(true);
  });

  it('preserves relative proportions', () => {
    const segments = [{ duration_mins: 10 }, { duration_mins: 30 }, { duration_mins: 60 }];
    const result = normalizeDurations(segments, 100);
    expect(sumDurations(result)).toBe(100);
    // Roughly 10/30/60 split of 100 -- allow rounding drift of a minute or two.
    expect(result[0].duration_mins).toBeGreaterThanOrEqual(8);
    expect(result[0].duration_mins).toBeLessThanOrEqual(12);
    expect(result[2].duration_mins).toBeGreaterThan(result[1].duration_mins);
  });

  it('preserves non-duration fields on each segment', () => {
    const segments = [{ id: 1, title: 'Intro', duration_mins: 5 }];
    const result = normalizeDurations(segments, 10);
    expect(result[0]).toMatchObject({ id: 1, title: 'Intro' });
  });

  it('returns the input unchanged for an empty list', () => {
    expect(normalizeDurations([], 30)).toEqual([]);
  });
});

describe('sumDurations', () => {
  it('sums duration_mins across segments, treating missing values as 0', () => {
    expect(sumDurations([{ duration_mins: 5 }, {}, { duration_mins: 3 }])).toBe(8);
  });
});
