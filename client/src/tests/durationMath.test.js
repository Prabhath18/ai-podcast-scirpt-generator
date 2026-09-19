import { describe, it, expect } from 'vitest';
import { sumDurations, toTimelineShares } from '../utils/durationMath.js';

describe('sumDurations', () => {
  it('adds up every segment duration', () => {
    expect(sumDurations([{ duration_mins: 5 }, { duration_mins: 10 }, { duration_mins: 3 }])).toBe(18);
  });

  it('treats missing/invalid durations as zero', () => {
    expect(sumDurations([{ duration_mins: 5 }, {}, { duration_mins: 'x' }])).toBe(5);
  });

  it('returns 0 for an empty or missing list', () => {
    expect(sumDurations([])).toBe(0);
    expect(sumDurations(undefined)).toBe(0);
  });
});

describe('toTimelineShares', () => {
  it('computes each segment as a percentage of the total', () => {
    const shares = toTimelineShares([
      { id: 1, title: 'A', duration_mins: 25 },
      { id: 2, title: 'B', duration_mins: 75 },
    ]);
    expect(shares).toEqual([
      { id: 1, title: 'A', percent: 25 },
      { id: 2, title: 'B', percent: 75 },
    ]);
  });

  it('returns an empty array for no segments', () => {
    expect(toTimelineShares([])).toEqual([]);
  });
});
