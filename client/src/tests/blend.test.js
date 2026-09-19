import { describe, it, expect } from 'vitest';
import { blendSegment, applyVariation, variationSummary } from '../utils/blend.js';
import { sumDurations } from '../utils/durationMath.js';

const seg = (id, title, duration, extra = {}) => ({
  id,
  title,
  talking_points: ['a', 'b', 'c'],
  duration_mins: duration,
  transition: 'next',
  ...extra,
});

const working = () => [seg(1, 'One', 6), seg(2, 'Two', 6), seg(3, 'Three', 6), seg(4, 'Four', 6), seg(5, 'Five', 6)];

describe('blendSegment: add', () => {
  it('appends the copied segment with a fresh id', () => {
    const next = blendSegment(working(), seg(1, 'From variation', 5), { mode: 'add' });
    expect(next).toHaveLength(6);
    expect(next[5].title).toBe('From variation');
    expect(next[5].id).toBe(6);
  });

  it('keeps the total duration the same as before the blend', () => {
    const before = working();
    const next = blendSegment(before, seg(1, 'X', 12), { mode: 'add' });
    expect(sumDurations(next)).toBe(sumDurations(before));
  });

  it('gives every segment at least one minute even when the addition is huge', () => {
    const next = blendSegment(working(), seg(1, 'Huge', 500), { mode: 'add' });
    expect(next.every((s) => s.duration_mins >= 1)).toBe(true);
    expect(sumDurations(next)).toBe(30);
  });

  it('refuses to go past eight segments', () => {
    const eight = [...working(), seg(6, 'Six', 6), seg(7, 'Seven', 6), seg(8, 'Eight', 6)];
    expect(blendSegment(eight, seg(1, 'Nine', 5), { mode: 'add' })).toBeNull();
  });

  it('does not carry pinned sources from the source outline', () => {
    const incoming = seg(1, 'Pinned', 5, { sources: [{ title: 'T', url: 'https://x.test', summary: '' }] });
    const next = blendSegment(working(), incoming, { mode: 'add' });
    expect(next[5].sources).toBeUndefined();
  });

  it('copies the talking points instead of sharing the array', () => {
    const incoming = seg(1, 'Shared?', 5);
    const next = blendSegment(working(), incoming, { mode: 'add' });
    next[5].talking_points.push('changed');
    expect(incoming.talking_points).toHaveLength(3);
  });

  it('does not mutate the working segments', () => {
    const before = working();
    const snapshot = JSON.stringify(before);
    blendSegment(before, seg(1, 'X', 5), { mode: 'add' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('blendSegment: replace', () => {
  it('swaps the target segment in place, keeping the count and position', () => {
    const next = blendSegment(working(), seg(9, 'Better three', 6), { mode: 'replace', targetId: 3 });
    expect(next).toHaveLength(5);
    expect(next[2].title).toBe('Better three');
    expect(next.map((s) => s.title)).toEqual(['One', 'Two', 'Better three', 'Four', 'Five']);
  });

  it('uses a new id so the replaced segment does not inherit the old Deep Dive cache', () => {
    const next = blendSegment(working(), seg(9, 'New', 6), { mode: 'replace', targetId: 3 });
    expect(next[2].id).not.toBe(3);
    expect(new Set(next.map((s) => s.id)).size).toBe(5);
  });

  it('re-normalizes durations to the previous total', () => {
    const next = blendSegment(working(), seg(9, 'Long', 20), { mode: 'replace', targetId: 2 });
    expect(sumDurations(next)).toBe(30);
    expect(next[1].duration_mins).toBeGreaterThan(next[0].duration_mins);
  });

  it('returns null for an unknown target or mode', () => {
    expect(blendSegment(working(), seg(9, 'X', 5), { mode: 'replace', targetId: 99 })).toBeNull();
    expect(blendSegment(working(), seg(9, 'X', 5), { mode: 'merge' })).toBeNull();
  });

  it('is allowed at the segment limit, since the count does not change', () => {
    const eight = [...working(), seg(6, 'Six', 6), seg(7, 'Seven', 6), seg(8, 'Eight', 6)];
    expect(blendSegment(eight, seg(9, 'X', 5), { mode: 'replace', targetId: 8 })).toHaveLength(8);
  });
});

describe('applyVariation', () => {
  const outline = {
    episode_title: 'Working',
    tone: 'Educational',
    total_duration_mins: 30,
    intro: 'old intro',
    segments: working(),
    guest_questions: ['old q'],
    outro: 'old outro',
    variations: [{ approach: 'A' }],
    intro_outro: { teaser: 'kept' },
  };
  const variation = {
    approach: 'Debate',
    outline: { ...outline, episode_title: 'Variation', intro: 'new intro', segments: [seg(1, 'V1', 30)], guest_questions: [], outro: 'new outro' },
  };

  it('replaces the episode shape with the variation', () => {
    const next = applyVariation(outline, variation);
    expect(next.episode_title).toBe('Variation');
    expect(next.intro).toBe('new intro');
    expect(next.segments).toHaveLength(1);
    expect(next.guest_questions).toEqual([]);
    expect(next.outro).toBe('new outro');
  });

  it('keeps the stored variations and any intro/outro set', () => {
    const next = applyVariation(outline, variation);
    expect(next.variations).toEqual([{ approach: 'A' }]);
    expect(next.intro_outro.teaser).toBe('kept');
  });
});

describe('variationSummary', () => {
  it('reports the segment count and live total', () => {
    expect(variationSummary({ outline: { segments: working(), total_duration_mins: 99 } })).toEqual({ segmentCount: 5, totalMins: 30 });
  });
});
