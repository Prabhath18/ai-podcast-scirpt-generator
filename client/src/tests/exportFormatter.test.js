import { describe, it, expect } from 'vitest';
import { toMarkdown, toPlainText, toPrintableHtml, printableBody, PRINT_STYLES, slugify } from '../utils/exportFormatter.js';

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

  it('prints the URL as text (paper cannot click), escapes titles, and drops non-http links', () => {
    const html = toPrintableHtml(withExtras(), {}, { includeSources: true });
    expect(html).toContain('Jazz &lt;b&gt;<span class="url">https://en.wikipedia.org/wiki/Jazz</span>');
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


// --- Print / PDF workflow -------------------------------------------------------------

const fullOutline = () => ({
  episode_title: 'The Full Script',
  tone: 'Educational',
  total_duration_mins: 20,
  intro: 'Host 1: Welcome in.\nHost 2: Glad to be here.',
  segments: [
    { id: 1, title: 'First part', talking_points: ['Point A', 'Point B', 'Point C'], duration_mins: 12, transition: 'Now the second part.', sources: [{ type: 'wikipedia', title: 'Jazz', url: 'https://en.wikipedia.org/wiki/Jazz', summary: 'x' }] },
    { id: 2, title: 'Second part', talking_points: ['Point D', 'Point E', 'Point F'], duration_mins: 8, transition: '' },
  ],
  guest_questions: ['Where did it start?', 'What changed?'],
  outro: 'Thanks for listening. Subscribe!',
});
const meta = { podcastName: 'The Weekly Signal', hostCount: 'duo' };
const research = { 1: { notes: 'First paragraph.\n\nSecond <b>paragraph</b>.', discussion_prompts: ['Ask about X?', 'Ask about Y?'] } };
const body = (options) => printableBody(fullOutline(), meta, options);

describe('print body: required sections', () => {
  it('contains every section of the finished script', () => {
    const html = body({ includeSources: true, researchNotes: research });
    for (const expected of [
      'The Full Script', // episode title
      'The Weekly Signal', // podcast name
      'Duo', // host information
      'Educational', // tone
      '20 mins', // total duration
      'Opening hook and introduction',
      'Welcome in.',
      'First part', '12 mins', 'Point A', 'Point C', // segment, duration, talking points
      'Transition: Now the second part.',
      'Second part', '8 mins',
      'Guest Questions', 'Where did it start?',
      'Outro and call to action', 'Subscribe!',
      'Research notes', 'First paragraph.', 'Follow-up prompts', 'Ask about X?',
      'Sources', 'https://en.wikipedia.org/wiki/Jazz',
    ]) {
      expect(html).toContain(expected);
    }
  });

  it('labels each fact so the header reads on paper', () => {
    const html = body();
    expect(html).toContain('<b>Podcast</b> The Weekly Signal');
    expect(html).toContain('<b>Hosts</b> Duo');
    expect(html).toContain('<b>Tone</b> Educational');
    expect(html).toContain('<b>Runtime</b> 20 mins');
  });

  it('uses the outline it is given, so edits are what gets printed', () => {
    const edited = { ...fullOutline(), episode_title: 'Edited Title', segments: fullOutline().segments.map((seg) => ({ ...seg, title: `${seg.title} (edited)` })) };
    const html = printableBody(edited, meta, {});
    expect(html).toContain('Edited Title');
    expect(html).toContain('First part (edited)');
    expect(html).not.toContain('The Full Script');
  });

  it('escapes research notes and every other value', () => {
    const html = body({ researchNotes: research });
    expect(html).toContain('Second &lt;b&gt;paragraph&lt;/b&gt;.');
    expect(html).not.toContain('<b>paragraph</b>');
  });

  it('shows speaker turns of a duo intro on separate labelled lines', () => {
    expect(body()).toContain('<span class="speaker">Host 2</span> Glad to be here.');
  });
});

describe('print body: sections that are off or empty are omitted cleanly', () => {
  it('omits guest questions when there are none, or when switched off', () => {
    expect(printableBody({ ...fullOutline(), guest_questions: [] }, meta, {})).not.toContain('Guest Questions');
    expect(body({ includeGuestQuestions: false })).not.toContain('Guest Questions');
    expect(body({ includeGuestQuestions: true })).toContain('Guest Questions');
    expect(body()).toContain('Guest Questions'); // on by default
  });

  it('ignores blank guest questions and blank talking points', () => {
    const html = printableBody({ ...fullOutline(), guest_questions: ['', '  '], segments: [{ ...fullOutline().segments[0], talking_points: ['', 'Only real point'] }, fullOutline().segments[1]] }, meta, {});
    expect(html).not.toContain('Guest Questions');
    expect(html).toContain('Only real point');
    expect(html).not.toContain('<li></li>');
  });

  it('omits the intro and outro blocks when empty', () => {
    const html = printableBody({ ...fullOutline(), intro: '  ', outro: '' }, meta, {});
    expect(html).not.toContain('Opening hook and introduction');
    expect(html).not.toContain('Outro and call to action');
  });

  it('omits research notes and sources unless asked for and available', () => {
    expect(body()).not.toContain('Research notes');
    expect(body()).not.toContain('Sources');
    expect(body({ includeSources: true })).toContain('Sources');
    expect(body({ includeSources: true })).not.toContain('Research notes');
    expect(body({ researchNotes: research })).toContain('Research notes');
    expect(body({ researchNotes: research })).not.toContain('Sources');
    expect(body({ researchNotes: { 1: { notes: '', discussion_prompts: [] } } })).not.toContain('Research notes');
  });

  it('leaves out the podcast and host facts when they are not set', () => {
    const html = printableBody(fullOutline(), {}, {});
    expect(html).not.toContain('<b>Podcast</b>');
    expect(html).not.toContain('<b>Hosts</b>');
    expect(html).toContain('<b>Tone</b>');
  });
});

describe('print styles', () => {
  it('hide the app and every control when printing, and print black on white', () => {
    const print = PRINT_STYLES.slice(PRINT_STYLES.indexOf('@media print'));
    expect(print).toMatch(/#root[^}]*display: none/);
    expect(print).toMatch(/\.no-print[^}]*display: none/);
    expect(print).toMatch(/\.script \*[^}]*color: #000 !important/);
    expect(print).toMatch(/background: transparent !important/);
    expect(print).toMatch(/box-shadow: none !important/);
  });

  it('set page margins, keep sections together, keep headings with their content, and wrap long text', () => {
    expect(PRINT_STYLES).toMatch(/@page \{[^}]*margin: 18mm/);
    expect(PRINT_STYLES).toMatch(/\.script \.row \{[^}]*break-inside: avoid/);
    expect(PRINT_STYLES).toMatch(/\.script h2 \{[^}]*break-after: avoid/);
    expect(PRINT_STYLES).toMatch(/overflow-wrap: anywhere/);
    expect(PRINT_STYLES).toContain('counter(page)');
  });

  it('bring back list bullets and numbers that the app-wide CSS reset removes', () => {
    expect(PRINT_STYLES).toMatch(/\.script ul \{[^}]*list-style: disc/);
    expect(PRINT_STYLES).toMatch(/\.script ol \{[^}]*list-style: decimal/);
  });

  it('let the in-app preview flow across pages instead of clipping to one fixed screen', () => {
    expect(PRINT_STYLES).toMatch(/\.print-root \{[^}]*position: static !important/);
  });
});
