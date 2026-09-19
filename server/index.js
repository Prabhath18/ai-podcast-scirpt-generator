import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer server/.env, fall back to a repo-root .env so `cp .env.example
// server/.env` and `cp .env.example .env` both work.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('[warn] JWT_SECRET is not set -- using an insecure development default. Set it in .env before deploying.');
  process.env.JWT_SECRET = 'dev-only-insecure-secret-change-me';
}

const { createDb } = await import('./db/init.js');
const { createApp } = await import('./app.js');

const databasePath = process.env.DATABASE_PATH || './data/podcast.sqlite';
const db = createDb(path.resolve(__dirname, databasePath));

// eslint-disable-next-line no-console
console.log(`[db] Using SQLite database at: ${path.resolve(__dirname, databasePath)}`);
const { describeLlmConfig } = await import('./services/llm.js');
const llm = describeLlmConfig();
if (llm.primary) {
  // eslint-disable-next-line no-console
  console.log(`[llm] Provider: ${llm.primary} (${llm.model})${llm.fallback ? `, falling back to ${llm.fallback}` : ''}`);
}
for (const problem of llm.problems) {
  // eslint-disable-next-line no-console
  console.warn(`[warn] ${problem} Live generation will fail until this is fixed. Use "Try a demo" in the app, or set it in .env.`);
}

const app = createApp(db);
const port = Number(process.env.PORT) || 8787;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Podcast Outline AI API listening on http://localhost:${port}`);
});

server.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error(
    err.code === 'EADDRINUSE'
      ? `[server] Port ${port} is already in use -- another dev server is probably still running. Stop it, or set PORT in server/.env.`
      : `[server] Failed to start: ${err.message}`,
  );
  process.exit(1);
});
