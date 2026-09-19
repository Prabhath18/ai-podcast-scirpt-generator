// Turns the current outline (including whatever the user has edited) into
// downloadable formats. Pure functions, no DOM/browser APIs, so they're
// easy to unit test and reused by both the "Download Script" button and
// scripts/buildSampleOutput.js (which regenerates sample-output/).

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

export function toMarkdown(outline, meta = {}) {
  const lines = [];
  lines.push(`# ${outline.episode_title}`);
  lines.push('');
  const meta_ = metaLines(meta);
  if (meta_.length) {
    lines.push(meta_.join(' | '));
    lines.push('');
  }
  lines.push(`**Tone:** ${outline.tone}  **Total length:** ${formatDuration(outline.total_duration_mins)}`);
  lines.push('');

  if (outline.intro) {
    lines.push('## Intro');
    lines.push(outline.intro);
    lines.push('');
  }

  outline.segments.forEach((segment, index) => {
    lines.push(`## Segment ${index + 1}: ${segment.title} (${formatDuration(segment.duration_mins)})`);
    lines.push('');
    segment.talking_points.forEach((point) => lines.push(`- ${point}`));
    if (segment.transition) {
      lines.push('');
      lines.push(`*Transition: ${segment.transition}*`);
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

export function toPlainText(outline, meta = {}) {
  const lines = [];
  const title = outline.episode_title.toUpperCase();
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');

  const meta_ = metaLines(meta);
  if (meta_.length) {
    lines.push(meta_.join('  |  '));
  }
  lines.push(`Tone: ${outline.tone}   Total length: ${formatDuration(outline.total_duration_mins)}`);
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
    segment.talking_points.forEach((point) => lines.push(`  * ${point}`));
    if (segment.transition) {
      lines.push('');
      lines.push(`  Transition -> ${segment.transition}`);
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

/** Full standalone HTML document, styled for print-to-PDF (see PrintableView.jsx for the on-screen equivalent). */
export function toPrintableHtml(outline, meta = {}) {
  const meta_ = metaLines(meta);
  const segmentsHtml = outline.segments
    .map(
      (segment, index) => `
      <section class="segment">
        <h2>Segment ${index + 1}: ${escapeHtml(segment.title)} <span class="pill">${formatDuration(segment.duration_mins)}</span></h2>
        <ul>${segment.talking_points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        ${segment.transition ? `<p class="transition">Transition: ${escapeHtml(segment.transition)}</p>` : ''}
      </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(outline.episode_title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 2rem auto; padding: 0 1.5rem; color: #17181f; line-height: 1.5; }
  h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
  .meta { color: #555; margin-bottom: 1.5rem; }
  .pill { font-size: 0.75rem; font-weight: normal; color: #555; border: 1px solid #ccc; border-radius: 999px; padding: 0.1rem 0.6rem; margin-left: 0.5rem; }
  .transition { font-style: italic; color: #444; }
  ol { padding-left: 1.25rem; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(outline.episode_title)}</h1>
  <p class="meta">${[...meta_, `Tone: ${outline.tone}`, `Total length: ${formatDuration(outline.total_duration_mins)}`]
    .map(escapeHtml)
    .join(' &middot; ')}</p>
  ${outline.intro ? `<section><h2>Intro</h2><p>${escapeHtml(outline.intro)}</p></section>` : ''}
  ${segmentsHtml}
  ${
    outline.guest_questions?.length
      ? `<section><h2>Guest Questions</h2><ol>${outline.guest_questions
          .map((q) => `<li>${escapeHtml(q)}</li>`)
          .join('')}</ol></section>`
      : ''
  }
  ${outline.outro ? `<section><h2>Outro</h2><p>${escapeHtml(outline.outro)}</p></section>` : ''}
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
