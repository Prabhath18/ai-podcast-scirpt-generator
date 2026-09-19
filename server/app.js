import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { sharedRouter } from './routes/shared.js';
import { outlineRouter } from './routes/outline.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

/**
 * Builds the Express app around a given database instance. Kept as a
 * factory (rather than a module-level singleton) so tests can pass in an
 * isolated, disposable SQLite database -- see server/tests/testApp.js.
 */
export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.locals.db = db;

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / non-browser requests (no Origin header) and
        // anything in the explicit allowlist.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(generalLimiter);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/shared', sharedRouter);
  app.use('/api', outlineRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
