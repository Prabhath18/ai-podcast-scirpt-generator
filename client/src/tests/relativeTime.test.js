import { describe, it, expect } from 'vitest';
import { relativeTime, nameFromEmail } from '../utils/relativeTime.js';

const NOW = Date.parse('2026-05-10T12:00:00Z');

describe('relativeTime', () => {
  it('reads SQLite UTC timestamps (no zone marker) as UTC', () => {
    expect(relativeTime('2026-05-10 11:55:00', NOW)).toBe('5 min ago');
  });

  it('handles ISO strings with a zone', () => {
    expect(relativeTime('2026-05-10T09:00:00Z', NOW)).toBe('3 h ago');
  });

  it('says "just now" under a minute', () => {
    expect(relativeTime('2026-05-10 11:59:40', NOW)).toBe('just now');
  });

  it('uses days for the past week, then a date', () => {
    expect(relativeTime('2026-05-08 12:00:00', NOW)).toBe('2 d ago');
    expect(relativeTime('2026-01-01 12:00:00', NOW)).toMatch(/2026/);
  });

  it('returns an empty string for garbage', () => {
    expect(relativeTime('not a date', NOW)).toBe('');
  });
});

describe('nameFromEmail', () => {
  it('uses the part before the @', () => {
    expect(nameFromEmail('maya.lee@example.com')).toBe('maya.lee');
  });
});
