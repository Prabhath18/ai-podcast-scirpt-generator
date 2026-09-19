import { describe, it, expect } from 'vitest';
import { toMarkdown, toPlainText, toPrintableHtml, slugify } from '../utils/exportFormatter.js';

const sampleOutline = {
  episode_title: 'Test Episode & "Friends"',
  tone: 'Educational',
  total_duration_mins: 10,
  intro: 'Welcome to the show.',
  segments: [
    {
      id: 1,
      title: 'Segment One <intro>',
      talking_points: ['Point A', 'Point B & C'],
      duration_mins: 6,
      transition: 'Moving on...',
    },
    {
      id: 2,
      title: 'Segment Two',
      talking_points: ['Point D'],
      duration_mins: 4,
      transition: '',
    },
  ],
  guest_questions: ['What is <this>?'],
  outro: 'Thanks for listening.',
};

describe('toMarkdown', () => {
  it('includes the episode title, segments, and guest questions', () => {
    const md = toMarkdown(sampleOutline, { podcastName: 'My Show', hostCount: 'solo' });
    expect(md).toContain('# Test Episode & "Friends"');
    expect(md).toContain('Podcast: My Show');
    expect(md).toContain('## Segment 1: Segment One <intro> (6 mins)');
    expect(md).toContain('- Point A');
    expect(md).toContain('## Guest Questions');
    expect(md).toContain('1. What is <this>?');
    expect(md).toContain('## Outro');
  });

  it('omits meta line when no podcast name or host count is given', () => {
    const md = toMarkdown(sampleOutline, {});
    expect(md.split('\n')[1]).not.toContain('Podcast:');
  });
});

describe('toPlainText', () => {
  it('uppercases the title and includes timing cues', () => {
    const text = toPlainText(sampleOutline);
    expect(text).toContain('TEST EPISODE & "FRIENDS"');
    expect(text).toMatch(/SEGMENT 1: SEGMENT ONE <INTRO>\s+\[6 mins\]/);
    expect(text).toContain('* Point A');
  });
});

describe('toPrintableHtml', () => {
  it('escapes HTML special characters from user-edited content', () => {
    const html = toPrintableHtml(sampleOutline);
    expect(html).toContain('Segment One &lt;intro&gt;');
    expect(html).toContain('What is &lt;this&gt;?');
    expect(html).not.toContain('<intro>');
  });

  it('produces a full standalone document', () => {
    const html = toPrintableHtml(sampleOutline);
    expect(html.trim().startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });
});

describe('slugify', () => {
  it('produces a filesystem-safe slug', () => {
    expect(slugify('Test Episode & "Friends"')).toBe('test-episode-friends');
  });

  it('falls back to "episode" for an empty/unsafe string', () => {
    expect(slugify('!!!')).toBe('episode');
  });
});
