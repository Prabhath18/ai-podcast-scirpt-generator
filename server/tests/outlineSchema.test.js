import { describe, it, expect } from 'vitest';
import { validateOutline } from '../validators/outlineSchema.js';

function validSegment(id) {
  return {
    id,
    title: `Segment ${id}`,
    talking_points: ['Point one', 'Point two', 'Point three'],
    duration_mins: 5,
    transition: 'Next up...',
  };
}

function validOutline(overrides = {}) {
  return {
    episode_title: 'A Great Episode',
    tone: 'Conversational',
    total_duration_mins: 25,
    intro: 'Welcome!',
    segments: [validSegment(1), validSegment(2), validSegment(3), validSegment(4), validSegment(5)],
    guest_questions: [],
    outro: 'Thanks for listening!',
    ...overrides,
  };
}

describe('validateOutline', () => {
  it('accepts a well-formed outline', () => {
    const result = validateOutline(validOutline());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects non-object input', () => {
    expect(validateOutline(null).valid).toBe(false);
    expect(validateOutline('nope').valid).toBe(false);
    expect(validateOutline([]).valid).toBe(false);
  });

  it('rejects missing required string fields', () => {
    const result = validateOutline(validOutline({ episode_title: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'episode_title')).toBe(true);
  });

  it('rejects fewer than 5 segments', () => {
    const result = validateOutline(validOutline({ segments: [validSegment(1), validSegment(2)] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'segments')).toBe(true);
  });

  it('rejects more than 8 segments', () => {
    const segments = Array.from({ length: 9 }, (_, i) => validSegment(i + 1));
    const result = validateOutline(validOutline({ segments }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'segments')).toBe(true);
  });

  it('rejects a segment with fewer than 3 talking points', () => {
    const segments = validOutline().segments;
    segments[0] = { ...segments[0], talking_points: ['only one'] };
    const result = validateOutline(validOutline({ segments }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'segments[0].talking_points')).toBe(true);
  });

  it('rejects a segment with more than 5 talking points', () => {
    const segments = validOutline().segments;
    segments[0] = { ...segments[0], talking_points: ['a', 'b', 'c', 'd', 'e', 'f'] };
    const result = validateOutline(validOutline({ segments }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'segments[0].talking_points')).toBe(true);
  });

  it('rejects a non-numeric segment duration', () => {
    const segments = validOutline().segments;
    segments[0] = { ...segments[0], duration_mins: 'five' };
    const result = validateOutline(validOutline({ segments }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'segments[0].duration_mins')).toBe(true);
  });

  it('rejects non-string guest questions', () => {
    const result = validateOutline(validOutline({ guest_questions: [42] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'guest_questions')).toBe(true);
  });
});
