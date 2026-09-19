import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { sharedRouter } from './routes/shared.js';
import { outlineRouter } from './routes/outline.js';
import { researchRouter } from './routes/research.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { assignRequestId, bindRequestContext } from './middleware/requestId.js';

/**
 * TRUST_PROXY tells Express how many reverse proxies sit in front of it, so req.ip (the key the
 * rate limiters count by) is the visitor's address and not the proxy's. Unset by default: trusting
 * X-Forwarded-For when there is no proxy would let anyone dodge the limits by spoofing it.
 *   TRUST_PROXY=1          one proxy (Railway, Render, Heroku, a single load balancer)
 *   TRUST_PROXY=true       trust everything (only behind a proxy you control)
 *   TRUST_PROXY=loopback   or a subnet / comma-separated list, as Express's "trust proxy" accepts
 */
export function parseTrustProxy(raw) {
  const value = raw?.trim();
  if (!value || value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/**
 * Builds the Express app around a given database instance. Kept as a
 * factory (rather than a module-level singleton) so tests can pass in an
 * isolated, disposable SQLite database -- see server/tests/testApp.js.
 */
export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.locals.db = db;
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== false) app.set('trust proxy', trustProxy);
  app.use(assignRequestId);

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
  // 300kb leaves room for an outline plus up to three stored variations.
  app.use(express.json({ limit: '300kb' }));
  app.use(cookieParser());
  app.use(bindRequestContext);
  app.use(generalLimiter);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/shared', sharedRouter);
  app.use('/api/research', researchRouter);
  app.use('/api', outlineRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
