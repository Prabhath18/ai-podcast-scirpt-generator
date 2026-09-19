import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer server/.env, fall back to a repo-root .env so `cp .env.example
// server/.env` and `cp .env.example .env` both work.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// dotenv has run, so the logger (which reads LOG_LEVEL) is imported after it.
const { logger } = await import('./utils/logger.js');

if (!process.env.JWT_SECRET) {
  logger.warn('JWT_SECRET is not set -- using an insecure development default. Set it in .env before deploying.');
  process.env.JWT_SECRET = 'dev-only-insecure-secret-change-me';
}

const { createDb } = await import('./db/init.js');
const { createApp } = await import('./app.js');
const { describeLlmConfig } = await import('./services/llm.js');
const { rateLimitStatus } = await import('./middleware/rateLimiter.js');

const databasePath = path.resolve(__dirname, process.env.DATABASE_PATH || './data/podcast.sqlite');
const db = createDb(databasePath);

const llm = describeLlmConfig();
const rateLimits = rateLimitStatus();
logger.info(
  {
    nodeEnv: process.env.NODE_ENV || 'development',
    database: databasePath,
    llmProvider: llm.primary,
    llmModel: llm.model,
    llmFallback: llm.fallback,
    // "redis" here means Redis is configured; it may still be connecting (a later line says when it is).
    rateLimitStore: rateLimits.configured ? 'redis' : 'memory',
    redisConnected: rateLimits.connected,
    trustProxy: process.env.TRUST_PROXY || false,
  },
  'server configuration',
);
for (const problem of llm.problems) {
  logger.warn(`${problem} Live generation will fail until this is fixed. Use "Try a demo" in the app, or set it in .env.`);
}

const app = createApp(db);
const port = Number(process.env.PORT) || 8787;

const server = app.listen(port, () => {
  logger.info({ port }, `Podcast Outline AI API listening on http://localhost:${port}`);
});

server.on('error', (err) => {
  logger.fatal(
    { err },
    err.code === 'EADDRINUSE'
      ? `Port ${port} is already in use -- another dev server is probably still running. Stop it, or set PORT in server/.env.`
      : `Failed to start: ${err.message}`,
  );
  process.exit(1);
});
