import { describe, it, expect } from 'vitest';
import { describeOutlineProgress, expectedSegmentCount } from '../utils/outlineProgress.js';

// The scanner reads an outline as the model is still writing it, so the interesting inputs are half-finished.

const segment = (n) => ({
  id: n,
  title: `Segment ${n}: a "quoted" title`,
  talking_points: ['first, with a comma', 'second: with a colon', 'third \\ with a backslash'],
  duration_mins: 5,
  transition: `On to part ${n + 1}.`,
});

const outline = {
  episode_title: 'How Lighthouses Work',
  tone: 'Conversational',
  total_duration_mins: 30,
  intro: 'Welcome. Tonight: light.',
  segments: [1, 2, 3, 4, 5, 6].map(segment),
  guest_questions: ['What drew you to lighthouses?'],
  outro: 'Thanks for listening.',
};
const FULL = JSON.stringify(outline);

describe('describeOutlineProgress', () => {
  it('starts at zero with nothing written', () => {
    expect(describeOutlineProgress('')).toEqual({ stage: 'starting', fraction: 0, segmentsDrafted: 0, segmentsExpected: 6, chars: 0 });
  });

  it('reports each part as it is reached', () => {
    const at = (needle) => describeOutlineProgress(FULL.slice(0, FULL.indexOf(needle) + needle.length), { lengthMins: 30 });

    expect(at('{"episode_title":"How Lighthouses Work"').stage).toBe('title');
    expect(at('"intro":"Welcome. Tonight: light."').stage).toBe('intro');
    expect(at('"segments":[{"id":1').stage).toBe('segments');
    expect(at('"guest_questions":[').stage).toBe('questions');
    expect(at('"outro":"Thanks').stage).toBe('outro');
  });

  it('does not count a string that is still being written', () => {
    const half = FULL.slice(0, FULL.indexOf('"intro":"Welcome') + '"intro":"Welc'.length);
    expect(describeOutlineProgress(half).stage).toBe('title'); // the intro's closing quote has not arrived
  });

  it('counts a segment as drafted once its last field is complete, including quotes and escapes inside', () => {
    const upTo = (n) => FULL.slice(0, FULL.indexOf(`"transition":"On to part ${n + 1}."`) + `"transition":"On to part ${n + 1}."`.length);

    expect(describeOutlineProgress(upTo(1), { lengthMins: 30 }).segmentsDrafted).toBe(1);
    expect(describeOutlineProgress(upTo(3), { lengthMins: 30 }).segmentsDrafted).toBe(3);
    expect(describeOutlineProgress(FULL, { lengthMins: 30 }).segmentsDrafted).toBe(6);
  });

  it('does not mistake the episode title or the total duration for a segment', () => {
    const noSegments = '{"episode_title":"A","tone":"x","total_duration_mins":30,"intro":"Hi.",';
    const result = describeOutlineProgress(noSegments);
    expect(result.segmentsDrafted).toBe(0);
    expect(result.stage).toBe('intro');
  });

  it('never claims "7 of about 6": the estimate grows to what has actually been seen', () => {
    const seven = JSON.stringify({ ...outline, segments: [1, 2, 3, 4, 5, 6, 7].map(segment) });
    const result = describeOutlineProgress(seven, { lengthMins: 30 });
    expect(result.segmentsDrafted).toBe(7);
    expect(result.segmentsExpected).toBe(7);
  });

  it('reads JSON wrapped in a code fence or a sentence (open models do this)', () => {
    const wrapped = `Sure! Here is your outline:\n\`\`\`json\n${FULL}\n\`\`\``;
    expect(describeOutlineProgress(wrapped).segmentsDrafted).toBe(6);
    expect(describeOutlineProgress(wrapped).stage).toBe('outro');
  });

  it('reads pretty-printed JSON too', () => {
    expect(describeOutlineProgress(JSON.stringify(outline, null, 2)).segmentsDrafted).toBe(6);
  });

  it('only ever moves forward as text arrives, and stays under 100% (the result event is the 100%)', () => {
    let previous = { fraction: 0, segmentsDrafted: 0 };
    for (let end = 0; end <= FULL.length; end += 7) {
      const now = describeOutlineProgress(FULL.slice(0, end), { lengthMins: 30 });
      expect(now.fraction).toBeGreaterThanOrEqual(previous.fraction);
      expect(now.segmentsDrafted).toBeGreaterThanOrEqual(previous.segmentsDrafted);
      expect(now.fraction).toBeLessThanOrEqual(0.95);
      previous = now;
    }
    expect(previous.segmentsDrafted).toBe(6);
    expect(previous.fraction).toBeGreaterThan(0.9);
  });

  it('reports how many characters have arrived', () => {
    expect(describeOutlineProgress('{"episode_title":"A"').chars).toBe(20);
  });

  it('copes with key order that differs from the schema (transition first)', () => {
    const reordered = JSON.stringify({ ...outline, segments: outline.segments.map(({ transition, ...rest }) => ({ transition, ...rest })) });
    expect(describeOutlineProgress(reordered).segmentsDrafted).toBe(6);
  });
});

describe('expectedSegmentCount', () => {
  it('scales with the episode length, inside the 5 to 8 the prompt asks for', () => {
    expect(expectedSegmentCount(10)).toBe(5);
    expect(expectedSegmentCount(30)).toBe(5);
    expect(expectedSegmentCount(40)).toBe(7);
    expect(expectedSegmentCount(60)).toBe(8);
    expect(expectedSegmentCount(180)).toBe(8);
  });

  it('has a sensible default for a missing or invalid length', () => {
    expect(expectedSegmentCount(undefined)).toBe(6);
    expect(expectedSegmentCount('abc')).toBe(6);
  });
});
