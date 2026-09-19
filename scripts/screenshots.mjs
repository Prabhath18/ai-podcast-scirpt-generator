// Captures the app in light and dark themes at phone, tablet and desktop
// widths. It drives your installed Chrome or Edge through playwright-core (no
// browser download) against the running dev servers.
//
//   npm run dev                                        (in another terminal)
//   node scripts/screenshots.mjs docs                  README screenshots -> docs/screenshots/
//   node scripts/screenshots.mjs review <folder>       every screen at 375/768/1024/1440, both themes
//
// The demo outlines are used throughout, so no API key is needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { demoOutlines } from '../client/src/services/demoData.js';
import { toPrintableHtml } from '../client/src/utils/exportFormatter.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.APP_URL || 'http://localhost:5173';
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const executablePath = BROWSERS.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found. Set the path in BROWSERS.');

const WIDTHS = { mobile: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, laptop: { width: 1024, height: 768 }, desktop: { width: 1440, height: 900 } };

const demoLabel = 'Tech: AI Coding Assistants';

/** Screens. Each one gets a page that is already on the app and prepares its own state. */
const SCREENS = {
  landing: async (page) => {
    await page.goto(BASE);
    await page.getByRole('heading', { level: 1 }).waitFor();
  },
  brief: async (page) => page.goto(`${BASE}/app`),
  outline: async (page) => {
    await page.goto(`${BASE}/app`);
    await page.getByRole('button', { name: demoLabel }).click();
    await page.locator('#segment-1').waitFor();
  },
  variations: async (page) => {
    await SCREENS.outline(page);
    await page.getByRole('tab', { name: /Variations/ }).click();
    await page.getByText('Compare structures').waitFor();
  },
  intro: async (page) => {
    await SCREENS.outline(page);
    await page.getByRole('tab', { name: 'Intro and outro' }).click();
    await page.getByText('Opening hooks').waitFor();
  },
  research: async (page) => {
    await SCREENS.outline(page);
    await page.locator('#segment-3').getByRole('button', { name: 'Research' }).click();
    await page.getByText('Sample sources for this demo').waitFor();
  },
  comments: async (page) => {
    await SCREENS.outline(page);
    await page.locator('#segment-3').getByRole('button', { name: /^Comments/ }).click();
    await page.getByText('Sample comments').waitFor();
  },
  // Generation states: the API request is intercepted, so no model call is made.
  progress: async (page) => {
    await page.route('**/api/generate-outline', () => {}); // never answers
    await page.goto(`${BASE}/app`);
    await page.getByLabel(/Topic/).fill('How lighthouses were automated');
    await page.getByRole('button', { name: 'Generate outline' }).click();
    await page.getByRole('region', { name: 'Generating Outline' }).waitFor();
    await page.waitForTimeout(4800); // into the second step
  },
  error: async (page) => {
    await page.route('**/api/generate-outline', (route) =>
      route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'x', code: 'LLM_INVALID_RESPONSE' }) }),
    );
    await page.goto(`${BASE}/app`);
    await page.getByLabel(/Topic/).fill('How lighthouses were automated');
    await page.getByRole('button', { name: 'Generate outline' }).click();
    await page.getByRole('alert').waitFor();
  },
  // Signs up a fresh account, so it belongs to docs mode only (the login limiter counts signups).
  episodes: async (page) => {
    await page.goto(`${BASE}/app`);
    await page.getByRole('button', { name: demoLabel }).click();
    await page.keyboard.press('Control+s');
    await page.getByRole('radio', { name: 'Create account' }).click();
    await page.getByLabel('Email').fill(`docs${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).last().click();
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: 'My episodes' }).click();
    await page.getByText('No episodes drafted yet').waitFor();
  },
  shortcuts: async (page) => {
    await SCREENS.outline(page);
    await page.keyboard.press('?');
    await page.getByRole('dialog').waitFor();
  },
};

async function shoot(browser, { screen, size, theme, file, fullPage }) {
  const context = await browser.newContext({ viewport: WIDTHS[size], deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript((t) => {
    try {
      localStorage.clear();
      localStorage.setItem('podcast-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
  const page = await context.newPage();
  await SCREENS[screen](page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage });
  await context.close();
  console.log('wrote', path.relative(root, file));
}

async function printPreview(browser, outDir) {
  const html = toPrintableHtml(demoOutlines[0].outline, { podcastName: 'The Weekly Signal', hostCount: 'duo' }, { includeSources: true });
  const context = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, 'print-view.png'), fullPage: true });
  await page.pdf({ path: path.join(outDir, 'print-view.pdf'), format: 'A4', printBackground: true });
  console.log('wrote print-view.png / .pdf');
  await context.close();
}

const [mode = 'docs', folder] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath });

if (mode === 'docs') {
  const out = path.join(root, 'docs', 'screenshots');
  fs.mkdirSync(out, { recursive: true });
  for (const theme of ['light', 'dark']) {
    await shoot(browser, { screen: 'outline', size: 'desktop', theme, file: path.join(out, `outline-${theme}-desktop.png`) });
    await shoot(browser, { screen: 'outline', size: 'mobile', theme, file: path.join(out, `outline-${theme}-mobile.png`) });
  }
  await shoot(browser, { screen: 'variations', size: 'desktop', theme: 'light', file: path.join(out, 'variations-light-desktop.png') });
  await shoot(browser, { screen: 'research', size: 'desktop', theme: 'light', file: path.join(out, 'research-light-desktop.png') });
  await shoot(browser, { screen: 'comments', size: 'desktop', theme: 'dark', file: path.join(out, 'comments-dark-desktop.png') });
  await shoot(browser, { screen: 'intro', size: 'desktop', theme: 'light', file: path.join(out, 'intro-outro-light-desktop.png') });
  await shoot(browser, { screen: 'brief', size: 'desktop', theme: 'light', file: path.join(out, 'brief-light-desktop.png') });
  await shoot(browser, { screen: 'progress', size: 'desktop', theme: 'light', file: path.join(out, 'generating-light-desktop.png') });
  await shoot(browser, { screen: 'error', size: 'desktop', theme: 'light', file: path.join(out, 'generation-error-light-desktop.png') });
  await shoot(browser, { screen: 'episodes', size: 'desktop', theme: 'light', file: path.join(out, 'my-episodes-empty-light-desktop.png') });
  for (const theme of ['light', 'dark']) {
    await shoot(browser, { screen: 'landing', size: 'desktop', theme, file: path.join(out, `landing-${theme}-desktop.png`), fullPage: true });
    await shoot(browser, { screen: 'landing', size: 'mobile', theme, file: path.join(out, `landing-${theme}-mobile.png`), fullPage: true });
  }
  await printPreview(browser, out);
} else {
  const out = path.resolve(folder || 'review');
  fs.mkdirSync(out, { recursive: true });
  for (const theme of ['light', 'dark']) {
    for (const size of Object.keys(WIDTHS)) {
      for (const screen of Object.keys(SCREENS).filter((name) => name !== 'episodes')) {
        await shoot(browser, { screen, size, theme, file: path.join(out, `${screen}-${theme}-${size}.png`), fullPage: screen === 'outline' || screen === 'landing' });
      }
    }
  }
  await printPreview(browser, out);
}

await browser.close();
