// Turns the current outline (including whatever the user has edited) into
// downloadable formats. Pure functions, no DOM/browser APIs, so they're
// easy to unit test and reused by both the "Export Script" dialog and
// scripts/buildSampleOutput.mjs (which regenerates sample-output/).
//
// Every formatter takes (outline, meta, options):
//   meta     { podcastName, hostCount }
//   options  { includeSources }  pinned sources are listed only when true
// The print formatter also understands includeGuestQuestions and researchNotes (see printableBody).
import { segmentTimings } from './durationMath.js';

const HOST_COUNT_LABEL = { solo: 'Solo', duo: 'Duo', group: 'Group' };

function formatDuration(mins) {
  return `${mins} min${mins === 1 ? '' : 's'}`;
}

function metaLines({ podcastName, hostCount }) {
  const lines = [];
  if (podcastName) lines.push(`Podcast: ${podcastName}`);
  if (hostCount) lines.push(`Hosts: ${HOST_COUNT_LABEL[hostCount] || hostCount}`);
  return lines;
}

function pinnedSources(segment, options) {
  return options.includeSources && Array.isArray(segment.sources) ? segment.sources : [];
}

export function toMarkdown(outline, meta = {}, options = {}) {
  const lines = [];
  const timings = segmentTimings(outline.segments);
  lines.push(`# ${outline.episode_title}`);
  lines.push('');
  const meta_ = metaLines(meta);
  if (meta_.length) {
    lines.push(meta_.join(' | '));
    lines.push('');
  }
  lines.push(`**Tone:** ${outline.tone}  **Total length:** ${formatDuration(outline.total_duration_mins)}`);
  lines.push('');
  const teaser = outline.intro_outro?.teaser?.trim();
  if (teaser) {
    lines.push(`> ${teaser}`);
    lines.push('');
  }

  if (outline.intro) {
    lines.push('## Intro');
    lines.push(outline.intro);
    lines.push('');
  }

  outline.segments.forEach((segment, index) => {
    lines.push(`## Segment ${index + 1}: ${segment.title} (${formatDuration(segment.duration_mins)})`);
    lines.push(`*${timings[index].start} - ${timings[index].end}*`);
    lines.push('');
    segment.talking_points.forEach((point) => lines.push(`- ${point}`));
    if (segment.transition) {
      lines.push('');
      lines.push(`*Transition: ${segment.transition}*`);
    }
    const sources = pinnedSources(segment, options);
    if (sources.length) {
      lines.push('');
      lines.push('**Sources** (verify before citing)');
      sources.forEach((source) => lines.push(`- [${source.title}](${source.url})`));
    }
    lines.push('');
  });

  if (outline.guest_questions?.length) {
    lines.push('## Guest Questions');
    outline.guest_questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push('');
  }

  if (outline.outro) {
    lines.push('## Outro');
    lines.push(outline.outro);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

export function toPlainText(outline, meta = {}, options = {}) {
  const lines = [];
  const timings = segmentTimings(outline.segments);
  const title = outline.episode_title.toUpperCase();
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');

  const meta_ = metaLines(meta);
  if (meta_.length) {
    lines.push(meta_.join('  |  '));
  }
  lines.push(`Tone: ${outline.tone}   Total length: ${formatDuration(outline.total_duration_mins)}`);
  const teaser = outline.intro_outro?.teaser?.trim();
  if (teaser) lines.push(`Teaser: ${teaser}`);
  lines.push('');

  if (outline.intro) {
    lines.push('INTRO');
    lines.push('-----');
    lines.push(outline.intro);
    lines.push('');
  }

  outline.segments.forEach((segment, index) => {
    const heading = `SEGMENT ${index + 1}: ${segment.title.toUpperCase()}  [${formatDuration(segment.duration_mins)}]`;
    lines.push(heading);
    lines.push('-'.repeat(heading.length));
    lines.push(`  ${timings[index].start} - ${timings[index].end}`);
    segment.talking_points.forEach((point) => lines.push(`  * ${point}`));
    if (segment.transition) {
      lines.push('');
      lines.push(`  Transition -> ${segment.transition}`);
    }
    const sources = pinnedSources(segment, options);
    if (sources.length) {
      lines.push('');
      lines.push('  Sources (verify before citing):');
      sources.forEach((source) => lines.push(`    - ${source.title}: ${source.url}`));
    }
    lines.push('');
  });

  if (outline.guest_questions?.length) {
    lines.push('GUEST QUESTIONS');
    lines.push('---------------');
    outline.guest_questions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
    lines.push('');
  }

  if (outline.outro) {
    lines.push('OUTRO');
    lines.push('-----');
    lines.push(outline.outro);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Paragraphs and "Host 1:" speaker turns in a script block, each on its own line. */
function scriptHtml(text) {
  return String(text)
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((line) => {
      const turn = line.match(/^\s*(Host \d):\s*(.*)$/);
      return turn
        ? `<p class="turn"><span class="speaker">${escapeHtml(turn[1])}</span> ${escapeHtml(turn[2])}</p>`
        : `<p>${escapeHtml(line)}</p>`;
    })
    .join('');
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

// Everything below is scoped under `.script`, so the same styles serve the standalone
// HTML file and the in-app Print Preview. The screen look is a white sheet; the print
// look (@media print) is plain black on white, with everything that is not the script
// hidden: the app (#root), the preview toolbar, and any control.
export const PRINT_STYLES = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  @page { @bottom-right { content: counter(page); font: 8pt 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #000; } }
  .script, .script * { box-sizing: border-box; }
  .script { margin: 0; color: #111827; background: #fff; overflow-wrap: anywhere; font: 11pt/1.55 Newsreader, Georgia, 'Times New Roman', serif; }
  .script .mono, .script .time, .script .label, .script .speaker, .script .facts, .script .url, .script .doc-toolbar { font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; }
  .script .page { max-width: 180mm; margin: 0 auto; padding: 12mm 0; }
  .script .doc-toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #4b5563; background: #f9fafb; }
  .script .doc-toolbar button { font: inherit; padding: 6px 12px; border: 1px solid #4f46e5; background: #4f46e5; color: #fff; border-radius: 4px; cursor: pointer; }
  .script .title-block { border-bottom: 2px solid #111827; padding-bottom: 10pt; margin-bottom: 14pt; break-after: avoid; page-break-after: avoid; }
  .script .kicker { font: 8.5pt 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; color: #4b5563; margin: 0 0 6pt; }
  .script h1 { font-size: 26pt; line-height: 1.12; font-weight: 600; margin: 0 0 8pt; letter-spacing: -.01em; }
  .script .facts { display: flex; flex-wrap: wrap; gap: 4pt 18pt; font-size: 9pt; color: #4b5563; margin: 0; }
  .script .facts b { font-weight: 600; color: #111827; }
  .script .teaser { font-style: italic; margin: 10pt 0 0; color: #374151; }
  .script .row { display: grid; grid-template-columns: 30mm 1fr; column-gap: 6mm; padding: 9pt 0; border-bottom: 0.5pt solid #d1d5db; break-inside: avoid; page-break-inside: avoid; }
  .script .time { font-size: 8.5pt; color: #4b5563; line-height: 1.5; padding-top: 3pt; }
  .script .time strong { display: block; color: #111827; font-weight: 600; }
  .script h2 { font-size: 14pt; line-height: 1.25; margin: 0 0 4pt; font-weight: 600; break-after: avoid; page-break-after: avoid; }
  .script h2 .num { color: #4f46e5; font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 10pt; margin-right: 6pt; }
  .script .label { font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: #4b5563; margin: 0 0 3pt; break-after: avoid; }
  .script p { margin: 0 0 5pt; orphans: 3; widows: 3; }
  .script .turn { padding-left: 14mm; text-indent: -14mm; }
  .script .speaker { display: inline-block; width: 13mm; font-size: 8.5pt; color: #4f46e5; text-indent: 0; }
  /* The app's CSS reset removes list markers; the script must put them back. */
  .script ul, .script ol { margin: 0 0 5pt; padding-left: 16pt; }
  .script ul { list-style: disc outside; }
  .script ol { list-style: decimal outside; }
  .script li { margin-bottom: 2pt; orphans: 2; widows: 2; }
  .script .transition { font-style: italic; color: #374151; }
  .script .notes, .script .sources { margin-top: 7pt; padding-top: 5pt; border-top: 0.5pt solid #d1d5db; font-size: 10pt; }
  .script .sources a { color: #111827; }
  .script .sources .note { color: #4b5563; font-style: italic; }
  .script .url { display: block; font-size: 7.5pt; color: #4b5563; }
  @media print {
    html, body { background: #fff !important; }
    #root, .no-print, .script .doc-toolbar { display: none !important; }
    .print-root { position: static !important; inset: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    .script .page { max-width: none; padding: 0; border: 0; box-shadow: none; }
    .script, .script * { color: #000 !important; background: transparent !important; box-shadow: none !important; text-shadow: none !important; }
    .script a { text-decoration: none; }
  }
`;

const nonBlank = (items) => (Array.isArray(items) ? items.filter((item) => typeof item === 'string' && item.trim()) : []);

/**
 * The finished script as HTML, laid out as a production script: a title block, then one
 * row per part with a timing column on the left. Segments and short sections never split
 * across a page. Every value is escaped. Sections with nothing to show are left out.
 *
 * options: { includeSources, includeGuestQuestions (default true), researchNotes }
 * where researchNotes maps a segment id to { notes, discussion_prompts } (Deep Dive).
 */
export function printableBody(outline, meta = {}, options = {}) {
  const timings = segmentTimings(outline.segments);
  const teaser = outline.intro_outro?.teaser?.trim();
  const facts = [
    meta.podcastName ? ['Podcast', meta.podcastName] : null,
    meta.hostCount ? ['Hosts', HOST_COUNT_LABEL[meta.hostCount] || meta.hostCount] : null,
    ['Tone', outline.tone],
    ['Runtime', formatDuration(outline.total_duration_mins)],
  ].filter(Boolean);

  const segmentRows = outline.segments
    .map((segment, index) => {
      const points = nonBlank(segment.talking_points);
      const sources = pinnedSources(segment, options).filter((s) => isHttpUrl(s.url));
      const research = options.researchNotes?.[segment.id];
      const researchParagraphs = research?.notes ? String(research.notes).split(/\n{2,}/).filter((t) => t.trim()) : [];
      const prompts = nonBlank(research?.discussion_prompts);
      const hasResearch = researchParagraphs.length > 0 || prompts.length > 0;

      return `
  <section class="row">
    <div class="time"><strong>${timings[index].start}</strong>to ${timings[index].end}<br />${formatDuration(segment.duration_mins)}</div>
    <div>
      <h2><span class="num">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(segment.title)}</h2>
      ${points.length ? `<ul>${points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
      ${segment.transition?.trim() ? `<p class="transition">Transition: ${escapeHtml(segment.transition)}</p>` : ''}
      ${
        hasResearch
          ? `<div class="notes"><p class="label">Research notes</p>${researchParagraphs.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}${
              prompts.length ? `<p class="label">Follow-up prompts</p><ul>${prompts.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''
            }</div>`
          : ''
      }
      ${
        sources.length
          ? `<div class="sources"><p class="label">Sources <span class="note">(verify before citing)</span></p><ul>${sources
              .map((s) => `<li>${escapeHtml(s.title)}<span class="url">${escapeHtml(s.url)}</span></li>`)
              .join('')}</ul></div>`
          : ''
      }
    </div>
  </section>`;
    })
    .join('\n');

  const block = (label, body) =>
    `<section class="row"><div class="time"><strong>${label}</strong></div><div>${body}</div></section>`;
  const questions = options.includeGuestQuestions === false ? [] : nonBlank(outline.guest_questions);

  return `<div class="page">
    <header class="title-block">
      <p class="kicker">Production script</p>
      <h1>${escapeHtml(outline.episode_title)}</h1>
      <p class="facts">${facts.map(([k, v]) => `<span><b>${k}</b> ${escapeHtml(v)}</span>`).join('')}</p>
      ${teaser ? `<p class="teaser">${escapeHtml(teaser)}</p>` : ''}
    </header>
    ${outline.intro?.trim() ? block('Open', `<h2>Opening hook and introduction</h2>${scriptHtml(outline.intro)}`) : ''}
    ${segmentRows}
    ${questions.length ? block('Guest', `<h2>Guest Questions</h2><ol>${questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>`) : ''}
    ${outline.outro?.trim() ? block('Close', `<h2>Outro and call to action</h2>${scriptHtml(outline.outro)}`) : ''}
  </div>`;
}

/** A complete standalone HTML file of the script, with its own print button (used for the sample exports). */
export function toPrintableHtml(outline, meta = {}, options = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(outline.episode_title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="script">
    <div class="doc-toolbar"><span>Production script preview</span><button type="button" onclick="window.print()">Print or save as PDF</button></div>
    ${printableBody(outline, meta, options)}
  </div>
</body>
</html>
`;
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'episode'
  );
}
