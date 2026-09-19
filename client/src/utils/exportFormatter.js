// Turns the current outline (including whatever the user has edited) into
// downloadable formats. Pure functions, no DOM/browser APIs, so they're
// easy to unit test and reused by both the "Download Script" button and
// scripts/buildSampleOutput.mjs (which regenerates sample-output/).
//
// Every formatter takes (outline, meta, options):
//   meta     { podcastName, hostCount }
//   options  { includeSources }  pinned sources are listed only when true
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

const PRINT_STYLES = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1c1a15; background: #fff; font: 11pt/1.5 Newsreader, Georgia, 'Times New Roman', serif; }
  .mono, .time, .kicker, .speaker, .no-print { font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; }
  .sheet { max-width: 180mm; margin: 0 auto; padding: 12mm 0; }
  .no-print { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #ddd6c6; font-size: 12px; color: #5c564a; background: #f6f3ec; }
  .no-print button { font: inherit; padding: 6px 12px; border: 1px solid #b8401b; background: #b8401b; color: #fff; border-radius: 4px; cursor: pointer; }
  .title-block { border-bottom: 2px solid #1c1a15; padding-bottom: 10pt; margin-bottom: 14pt; }
  .kicker { font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: #5c564a; margin: 0 0 6pt; }
  h1 { font-size: 26pt; line-height: 1.12; font-weight: 600; margin: 0 0 8pt; letter-spacing: -.01em; }
  .facts { display: flex; flex-wrap: wrap; gap: 4pt 18pt; font-size: 9pt; color: #5c564a; margin: 0; }
  .facts b { font-weight: 600; color: #1c1a15; }
  .teaser { font-style: italic; margin: 10pt 0 0; color: #3b372f; }
  .row { display: grid; grid-template-columns: 30mm 1fr; column-gap: 6mm; padding: 9pt 0; border-bottom: 0.5pt solid #d9d2c1; break-inside: avoid; page-break-inside: avoid; }
  .time { font-size: 8.5pt; color: #5c564a; line-height: 1.5; padding-top: 3pt; }
  .time strong { display: block; color: #1c1a15; font-weight: 600; }
  h2 { font-size: 14pt; line-height: 1.25; margin: 0 0 4pt; font-weight: 600; break-after: avoid; }
  h2 .num { color: #b8401b; font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 10pt; margin-right: 6pt; }
  .label { font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: #5c564a; margin: 0 0 3pt; }
  p { margin: 0 0 5pt; }
  .turn { padding-left: 14mm; text-indent: -14mm; }
  .speaker { display: inline-block; width: 13mm; font-size: 8.5pt; color: #b8401b; text-indent: 0; }
  ul, ol { margin: 0 0 5pt; padding-left: 16pt; }
  li { margin-bottom: 2pt; }
  .transition { font-style: italic; color: #3b372f; }
  .sources { margin-top: 6pt; font-size: 9.5pt; }
  .sources a { color: #1c1a15; }
  .sources .note { color: #5c564a; font-style: italic; }
  @media print { .no-print { display: none; } .sheet { padding: 0; max-width: none; } }
`;

/**
 * Full standalone HTML document laid out as a production script: a title
 * block, then one row per part with a timing column on the left. Segments and
 * short sections never split across a page.
 */
export function toPrintableHtml(outline, meta = {}, options = {}) {
  const timings = segmentTimings(outline.segments);
  const teaser = outline.intro_outro?.teaser?.trim();
  const facts = [
    meta.hostCount ? ['Hosts', HOST_COUNT_LABEL[meta.hostCount] || meta.hostCount] : null,
    ['Tone', outline.tone],
    ['Runtime', formatDuration(outline.total_duration_mins)],
  ].filter(Boolean);

  const segmentRows = outline.segments
    .map((segment, index) => {
      const sources = pinnedSources(segment, options).filter((s) => isHttpUrl(s.url));
      return `
  <section class="row">
    <div class="time"><strong>${timings[index].start}</strong>to ${timings[index].end}<br />${formatDuration(segment.duration_mins)}</div>
    <div>
      <h2><span class="num">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(segment.title)}</h2>
      <ul>${segment.talking_points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      ${segment.transition ? `<p class="transition">Transition: ${escapeHtml(segment.transition)}</p>` : ''}
      ${
        sources.length
          ? `<div class="sources"><p class="label">Sources <span class="note">(verify before citing)</span></p><ul>${sources
              .map((s) => `<li><a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a></li>`)
              .join('')}</ul></div>`
          : ''
      }
    </div>
  </section>`;
    })
    .join('\n');

  const block = (label, body) =>
    `<section class="row"><div class="time"><strong>${label}</strong></div><div>${body}</div></section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(outline.episode_title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="no-print"><span>Production script preview</span><button type="button" onclick="window.print()">Print or save as PDF</button></div>
  <main class="sheet">
    <header class="title-block">
      <p class="kicker">${escapeHtml(meta.podcastName || 'Episode script')}</p>
      <h1>${escapeHtml(outline.episode_title)}</h1>
      <p class="facts">${facts.map(([k, v]) => `<span><b>${k}</b> ${escapeHtml(v)}</span>`).join('')}</p>
      ${teaser ? `<p class="teaser">${escapeHtml(teaser)}</p>` : ''}
    </header>
    ${outline.intro ? block('Open', `<h2>Intro</h2>${scriptHtml(outline.intro)}`) : ''}
    ${segmentRows}
    ${
      outline.guest_questions?.length
        ? block('Guest', `<h2>Guest Questions</h2><ol>${outline.guest_questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>`)
        : ''
    }
    ${outline.outro ? block('Close', `<h2>Outro</h2>${scriptHtml(outline.outro)}`) : ''}
  </main>
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
