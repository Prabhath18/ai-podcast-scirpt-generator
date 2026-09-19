// Request correlation. Two small middlewares, in this order in app.js:
//
//   assignRequestId    first: gives every request an id (a valid X-Request-Id from a proxy, else a
//                      new UUID), echoes it in the X-Request-Id response header, and writes one
//                      access-log line when the response finishes.
//   bindRequestContext after the body parsers: makes the id available to everything the handler
//                      awaits. (It has to come after them: body parsing resumes on a stream event,
//                      which does not carry async context.)
//
// The id is never added to the JSON error body, which stays exactly { error, code }.
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';
import { runWithRequestId } from '../utils/requestContext.js';

// Accept an id from a proxy only if it is short and boring, so it cannot be used to forge log lines.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function assignRequestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    // Health checks and comment polling would drown everything else at info level.
    // (originalUrl, not req.path: inside a mounted router req.path is relative to the mount, e.g. "/me" for /api/auth/me)
    const path = req.originalUrl.split('?')[0];
    const quiet = path === '/api/health';
    logger[quiet ? 'debug' : 'info'](
      { reqId: req.id, method: req.method, path, status: res.statusCode, durationMs: Math.round(durationMs), ip: req.ip },
      'request',
    );
  });
  next();
}

export function bindRequestContext(req, _res, next) {
  runWithRequestId(req.id, next);
}
