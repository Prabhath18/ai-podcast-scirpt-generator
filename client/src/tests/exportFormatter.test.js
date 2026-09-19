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

const withExtras = () => ({
  ...sampleOutline,
  intro_outro: { hooks: [], intro_script: '', outros: [], teaser: 'A short teaser.' },
  segments: [
    {
      ...sampleOutline.segments[0],
      sources: [
        { type: 'wikipedia', title: 'Jazz <b>', url: 'https://en.wikipedia.org/wiki/Jazz', summary: 'A genre.' },
        { type: 'news', title: 'Evil link', url: 'javascript:alert(1)', summary: '' },
      ],
    },
    sampleOutline.segments[1],
  ],
});

describe('timings in exports', () => {
  it('adds a running clock to each segment', () => {
    expect(toMarkdown(sampleOutline)).toContain('*00:00 - 06:00*');
    expect(toMarkdown(sampleOutline)).toContain('*06:00 - 10:00*');
    expect(toPlainText(sampleOutline)).toContain('06:00 - 10:00');
  });

  it('shows the timing column in the printable script', () => {
    const html = toPrintableHtml(sampleOutline);
    expect(html).toContain('<strong>06:00</strong>');
    expect(html).toContain('to 10:00');
  });
});

describe('pinned sources in exports', () => {
  it('leaves sources out unless includeSources is set', () => {
    expect(toMarkdown(withExtras())).not.toContain('Sources');
    expect(toPlainText(withExtras())).not.toContain('Sources');
    expect(toPrintableHtml(withExtras())).not.toContain('Wikipedia/wiki');
  });

  it('lists them with a verify note when included', () => {
    const md = toMarkdown(withExtras(), {}, { includeSources: true });
    expect(md).toContain('**Sources** (verify before citing)');
    expect(md).toContain('[Jazz <b>](https://en.wikipedia.org/wiki/Jazz)');
    expect(toPlainText(withExtras(), {}, { includeSources: true })).toContain('Jazz <b>: https://en.wikipedia.org/wiki/Jazz');
  });

  it('escapes titles and drops non-http links in the printable HTML', () => {
    const html = toPrintableHtml(withExtras(), {}, { includeSources: true });
    expect(html).toContain('<a href="https://en.wikipedia.org/wiki/Jazz">Jazz &lt;b&gt;</a>');
    expect(html).not.toContain('javascript:');
  });
});

describe('teaser and speaker turns', () => {
  it('includes the teaser line when one is set', () => {
    expect(toMarkdown(withExtras())).toContain('> A short teaser.');
    expect(toPlainText(withExtras())).toContain('Teaser: A short teaser.');
    expect(toPrintableHtml(withExtras())).toContain('A short teaser.');
  });

  it('prints Host N turns of a duo intro as separate labelled lines', () => {
    const html = toPrintableHtml({ ...sampleOutline, intro: 'Host 1: Hello there.\nHost 2: Hi <all>.' });
    expect(html).toContain('<span class="speaker">Host 1</span> Hello there.');
    expect(html).toContain('Hi &lt;all&gt;.');
  });

  it('keeps each segment together on a page', () => {
    expect(toPrintableHtml(sampleOutline)).toMatch(/\.row \{[^}]*break-inside: avoid/);
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
