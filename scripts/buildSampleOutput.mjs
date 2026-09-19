// Regenerates sample-output/ from the same bundled demo data and export
// formatter the app itself uses (client/src/services/demoData.js,
// client/src/utils/exportFormatter.js) -- so the checked-in samples can
// never drift from what "Try a demo" + "Download Script" actually produce.
//
// Run with: node scripts/buildSampleOutput.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoOutlines } from '../client/src/services/demoData.js';
import { toMarkdown, toPlainText, toPrintableHtml, slugify } from '../client/src/utils/exportFormatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'sample-output');

fs.mkdirSync(outDir, { recursive: true });

for (const demo of demoOutlines) {
  const slug = slugify(demo.outline.episode_title);
  const meta = {}; // demo outlines have no podcastName/hostCount attached

  fs.writeFileSync(path.join(outDir, `${slug}.md`), toMarkdown(demo.outline, meta));
  fs.writeFileSync(path.join(outDir, `${slug}.txt`), toPlainText(demo.outline, meta));
  fs.writeFileSync(path.join(outDir, `${slug}.html`), toPrintableHtml(demo.outline, meta));

  console.log(`Wrote ${slug}.md / .txt / .html`);
}
