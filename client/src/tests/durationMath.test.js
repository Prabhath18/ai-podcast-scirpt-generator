import { describe, it, expect } from 'vitest';
import { sumDurations, normalizeDurations, formatClock, segmentTimings } from '../utils/durationMath.js';

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

describe('normalizeDurations', () => {
  const mins = (segments) => segments.map((s) => s.duration_mins);

  it('scales proportionally and hits the target exactly', () => {
    const result = normalizeDurations([{ duration_mins: 10 }, { duration_mins: 20 }, { duration_mins: 30 }], 30);
    expect(mins(result)).toEqual([5, 10, 15]);
  });

  it('spreads rounding error so the sum is still exact', () => {
    const result = normalizeDurations([{ duration_mins: 1 }, { duration_mins: 1 }, { duration_mins: 1 }], 10);
    expect(sumDurations(result)).toBe(10);
    expect(Math.max(...mins(result)) - Math.min(...mins(result))).toBeLessThanOrEqual(1);
  });

  it('never returns a segment under one minute', () => {
    const result = normalizeDurations([{ duration_mins: 1 }, { duration_mins: 1000 }], 20);
    expect(Math.min(...mins(result))).toBeGreaterThanOrEqual(1);
    expect(sumDurations(result)).toBe(20);
  });

  it('treats missing durations as very small but still gives them a minute', () => {
    const result = normalizeDurations([{}, { duration_mins: 10 }], 11);
    expect(mins(result)).toEqual([1, 10]);
  });

  it('raises a too-small target to one minute per segment', () => {
    expect(sumDurations(normalizeDurations([{ duration_mins: 5 }, { duration_mins: 5 }, { duration_mins: 5 }], 1))).toBe(3);
  });

  it('keeps other segment fields and does not mutate the input', () => {
    const input = [{ id: 7, title: 'Keep', duration_mins: 3 }, { id: 8, title: 'Me', duration_mins: 3 }];
    const result = normalizeDurations(input, 10);
    expect(result[0]).toMatchObject({ id: 7, title: 'Keep' });
    expect(input[0].duration_mins).toBe(3);
  });

  it('returns an empty list untouched', () => {
    expect(normalizeDurations([], 30)).toEqual([]);
  });
});

describe('formatClock and segmentTimings', () => {
  it('formats minutes as MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(6)).toBe('06:00');
    expect(formatClock(6.5)).toBe('06:30');
  });

  it('switches to H:MM:SS when asked', () => {
    expect(formatClock(75, true)).toBe('1:15:00');
  });

  it('builds a running clock across segments', () => {
    const timings = segmentTimings([
      { id: 1, duration_mins: 6 },
      { id: 2, duration_mins: 4 },
      { id: 3, duration_mins: 10 },
    ]);
    expect(timings).toEqual([
      { id: 1, start: '00:00', end: '06:00' },
      { id: 2, start: '06:00', end: '10:00' },
      { id: 3, start: '10:00', end: '20:00' },
    ]);
  });

  it('uses hours for every row once the episode is an hour or longer', () => {
    const timings = segmentTimings([{ id: 1, duration_mins: 45 }, { id: 2, duration_mins: 30 }]);
    expect(timings[1]).toEqual({ id: 2, start: '0:45:00', end: '1:15:00' });
  });
});
