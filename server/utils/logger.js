// The server's one logger: structured JSON lines (pino), one object per event.
//
//   LOG_LEVEL   trace | debug | info (default) | warn | error | fatal | silent
//
// Every line written while a request is being handled carries that request's `reqId` (see
// utils/requestContext.js and middleware/requestId.js), so one request can be followed across
// the access log, the LLM call it triggered and any error it ended in. Tests run silent unless
// they turn logging on with captureLogs().
import pino from 'pino';
import { currentRequestId } from './requestContext.js';

// pino writes to whatever object has write(); routing through one indirection lets a test
// collect the lines instead of printing them.
let sink = (line) => process.stdout.write(line);

const destination = { write: (line) => sink(line) };

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    base: { service: 'podcast-outline-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Adds the current request's id to every line logged inside that request.
    mixin() {
      const reqId = currentRequestId();
      return reqId ? { reqId } : {};
    },
    // Never log credentials, even if an object that holds them is passed in by mistake.
    redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie'], censor: '[redacted]' },
  },
  destination,
);

/**
 * Test helper: collects log lines (parsed) instead of printing them, at `level`. Call the
 * returned restore() when done.
 */
export function captureLogs(level = 'debug') {
  const lines = [];
  const previousSink = sink;
  const previousLevel = logger.level;
  sink = (line) => lines.push(JSON.parse(line));
  logger.level = level;
  return {
    lines,
    restore() {
      sink = previousSink;
      logger.level = previousLevel;
    },
  };
}
