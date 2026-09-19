// Verifies that every text/background pair used in the UI meets WCAG AA (4.5:1
// for text) in both themes. Reads the tokens straight from client/src/index.css
// so the check can't drift from the real palette.
//
// Run with: node scripts/checkContrast.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'src', 'index.css'), 'utf-8');

function readTokens(selector) {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))[1];
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)].map(([, name, r, g, b]) => [name, [r, g, b].map(Number)]),
  );
}

const luminance = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, where it is used]
const PAIRS = [
  ['ink', 'paper', 'body text on the app background'],
  ['ink', 'page', 'body text on the document'],
  ['ink-muted', 'page', 'secondary text on the document'],
  ['ink-muted', 'paper', 'secondary text on the app background'],
  ['ink-muted', 'sunken', 'secondary text on wells and hover fills'],
  ['ink-faint', 'page', 'labels and timings on the document'],
  ['ink-faint', 'paper', 'labels on the app background'],
  ['ink-faint', 'sunken', 'labels on wells'],
  ['accent', 'page', 'accent links and active tabs'],
  ['accent', 'paper', 'accent on the app background'],
  ['accent', 'sunken', 'accent on hover fills'],
  ['accent-fg', 'accent', 'primary button label'],
  ['accent-fg', 'accent-hover', 'primary button label, hovered'],
  ['ink', 'accent-tint', 'text on the active segment tint'],
  ['ok', 'ok-tint', 'success message'],
  ['warn', 'warn-tint', 'warning message'],
  ['danger', 'danger-tint', 'error message'],
  ['danger', 'page', 'inline error text'],
  ['ok', 'page', 'saved status'],
  ['warn', 'page', 'unsaved status'],
];

let failures = 0;
for (const [theme, selector] of [['light', ':root'], ['dark', '\\.dark']]) {
  const tokens = readTokens(selector);
  console.log(`\n${theme}`);
  for (const [fg, bg, use] of PAIRS) {
    const value = ratio(tokens[fg], tokens[bg]);
    const ok = value >= 4.5;
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${value.toFixed(2).padStart(5)}  ${fg} on ${bg}  (${use})`);
  }
}

if (failures) {
  console.error(`\n${failures} pair(s) below 4.5:1`);
  process.exit(1);
}
console.log('\nAll pairs meet WCAG AA (4.5:1).');
