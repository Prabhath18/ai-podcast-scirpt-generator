import { Router } from 'express';
import { callStructuredLLM } from '../services/llmHelper.js';
import { buildOutlinePrompt } from '../prompts/outlinePrompt.js';
import { buildDeepDivePrompt } from '../prompts/deepDivePrompt.js';
import { buildGuestQuestionsPrompt } from '../prompts/guestQuestionsPrompt.js';
import { buildVariationsPrompt } from '../prompts/variationsPrompt.js';
import { buildIntroOutroPrompt } from '../prompts/introOutroPrompt.js';
import {
  outlineResponseSchema,
  deepDiveResponseSchema,
  guestQuestionsResponseSchema,
  variationsResponseSchema,
  introOutroResponseSchema,
} from '../prompts/schemas.js';
import { validateOutline } from '../validators/outlineSchema.js';
import { validateGeneratedIntroOutro } from '../validators/introOutroSchema.js';
import { buildVariationsValidator } from '../services/variations.js';
import {
  validateOutlineRequest,
  validateExpandSegmentRequest,
  validateGuestQuestionsRequest,
  validateVariationsRequest,
  validateIntroOutroRequest,
} from '../validators/requestValidators.js';
import { normalizeDurations } from '../utils/duration.js';
import { getCached, setCached, hashKey } from '../utils/memoryCache.js';
import { asyncHandler, logRequestError, toErrorResponse } from '../middleware/errorHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { llmLimiter } from '../middleware/rateLimiter.js';
import { describeOutlineProgress } from '../utils/outlineProgress.js';
import { logger } from '../utils/logger.js';

export const outlineRouter = Router();
outlineRouter.use(optionalAuth);
outlineRouter.use(llmLimiter);

function validationError(errors) {
  const error = new Error('Request failed validation.');
  error.code = 'VALIDATION_ERROR';
  error.details = errors;
  return error;
}

/**
 * Loads a project-scoped Deep Dive cache row, but only when the requester
 * actually owns that project -- otherwise `projectId` is treated as absent
 * and we silently fall back to the anonymous in-memory cache. This keeps
 * /api/expand-segment usable both logged-out (localStorage-only outlines)
 * and logged-in (persisted, cross-device cache) without a separate route.
 */
function getOwnedProject(db, projectId, userId) {
  if (!projectId || !userId) return null;
  return db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId) || null;
}

/** The prompt and target length for a validated outline request. Shared by the plain and the streaming route. */
function buildOutlineRequest(body) {
  const { topic, tone, podcastName, hostCount, lengthMins, includeGuests, guestNames, guestBio } = body;
  const prompt = buildOutlinePrompt({
    topic: topic.trim(),
    tone: tone.trim(),
    podcastName: podcastName?.trim(),
    hostCount,
    lengthMins: Number(lengthMins),
    includeGuests: Boolean(includeGuests),
    guestNames: guestNames?.trim(),
    guestBio: guestBio?.trim(),
  });
  return { prompt, lengthMins: Number(lengthMins) };
}

/**
 * Renumbers segment ids 1..N and rescales durations so they always sum to the requested length,
 * regardless of what the model actually returned.
 */
function finalizeOutline(outline, lengthMins) {
  outline.segments = outline.segments.map((segment, index) => ({ ...segment, id: index + 1 }));
  outline.segments = normalizeDurations(outline.segments, lengthMins);
  outline.total_duration_mins = lengthMins;
  return outline;
}

// POST /api/generate-outline
outlineRouter.post(
  '/generate-outline',
  asyncHandler(async (req, res) => {
    const { valid, errors } = validateOutlineRequest(req.body || {});
    if (!valid) throw validationError(errors);

    const { prompt, lengthMins } = buildOutlineRequest(req.body);
    const outline = await callStructuredLLM(prompt, outlineResponseSchema, validateOutline);

    res.status(201).json({ outline: finalizeOutline(outline, lengthMins) });
  }),
);

const SSE_HEARTBEAT_MS = 15_000; // keeps proxies from closing a stream that is waiting on a cold model
const PROGRESS_EVERY_MS = 120; // at most this many progress events per second, however fast tokens arrive

// POST /api/generate-outline/stream
//
// The same request, validation, prompt, model call, parse/validate/retry-once and post-processing as
// /api/generate-outline. The difference is delivery: the response is a Server-Sent Events stream, so
// the client sees real progress while the model writes.
//
//   event: start     { }                                   the stream is open
//   event: progress  { stage, fraction, segmentsDrafted, segmentsExpected, chars }
//                    stage: starting | title | intro | segments | questions | outro | retrying
//   event: result    { outline }                           the finished, validated outline (last event)
//   event: error     { error, code, details? }             instead of result; same body as the JSON errors
//
// A request that fails validation (or the rate limit) is answered as ordinary JSON with the usual
// status, because nothing has been streamed yet. Once the stream is open, failures are `error` events.
outlineRouter.post(
  '/generate-outline/stream',
  asyncHandler(async (req, res) => {
    const { valid, errors } = validateOutlineRequest(req.body || {});
    if (!valid) throw validationError(errors);

    const { prompt, lengthMins } = buildOutlineRequest(req.body);
    const started = Date.now();

    // Stop asking the model if the browser goes away (tab closed, "New Podcast" clicked, network dropped).
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // tell nginx-style proxies not to hold the stream back
    });
    res.flushHeaders();
    res.socket?.setNoDelay(true);

    const send = (event, data) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const heartbeat = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) res.write(': keep-alive\n\n');
    }, SSE_HEARTBEAT_MS);

    let text = '';
    let lastProgressAt = 0;
    let outcome = 'ok';
    send('start', {});

    try {
      const outline = await callStructuredLLM(prompt, outlineResponseSchema, validateOutline, {
        signal: controller.signal,
        onChunk: (delta) => {
          text += delta;
          const now = Date.now();
          if (now - lastProgressAt < PROGRESS_EVERY_MS) return;
          lastProgressAt = now;
          send('progress', describeOutlineProgress(text, { lengthMins }));
        },
        // The text starts over (a retry after a failed validation, or the fallback provider): say so and reset.
        onRestart: ({ reason }) => {
          text = '';
          lastProgressAt = 0;
          send('progress', { stage: 'retrying', reason, fraction: 0, segmentsDrafted: 0, segmentsExpected: describeOutlineProgress('', { lengthMins }).segmentsExpected, chars: 0 });
        },
      });
      send('result', { outline: finalizeOutline(outline, lengthMins) });
    } catch (err) {
      if (controller.signal.aborted) {
        outcome = 'client_disconnected';
      } else {
        const { status, body } = toErrorResponse(err);
        outcome = body.code;
        logRequestError(err, { reqId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status, code: body.code });
        send('error', body);
      }
    } finally {
      clearInterval(heartbeat);
      logger.info({ event: 'outline_stream', outcome, durationMs: Date.now() - started, chars: text.length }, 'outline stream finished');
      res.end();
    }
  }),
);

// POST /api/generate-variations -- ONE call returns `count` differently structured outlines.
outlineRouter.post(
  '/generate-variations',
  asyncHandler(async (req, res) => {
    const { valid, errors } = validateVariationsRequest(req.body || {});
    if (!valid) throw validationError(errors);

    const { topic, tone, podcastName, hostCount, lengthMins, includeGuests, guestNames, guestBio } = req.body;
    const count = Number(req.body.count);

    const prompt = buildVariationsPrompt({
      topic: topic.trim(),
      tone: tone.trim(),
      podcastName: podcastName?.trim(),
      hostCount,
      lengthMins: Number(lengthMins),
      includeGuests: Boolean(includeGuests),
      guestNames: guestNames?.trim(),
      guestBio: guestBio?.trim(),
      count,
    });

    const validate = buildVariationsValidator({
      count,
      tone: tone.trim(),
      lengthMins: Number(lengthMins),
      includeGuests: Boolean(includeGuests),
    });
    const { variations } = await callStructuredLLM(prompt, variationsResponseSchema, validate);

    // `skipped` tells the UI how many variations failed validation twice and were dropped.
    res.status(201).json({ variations, skipped: count - variations.length });
  }),
);

// POST /api/intro-outro -- hooks in five styles, a full intro script, three outros and a teaser, in one call.
outlineRouter.post(
  '/intro-outro',
  asyncHandler(async (req, res) => {
    const { valid, errors } = validateIntroOutroRequest(req.body || {});
    if (!valid) throw validationError(errors);

    const { topic, tone, podcastName, lengthMins, outline } = req.body;
    const hostCount = req.body.hostCount || 'solo';

    const prompt = buildIntroOutroPrompt({ topic, tone, podcastName, hostCount, lengthMins, outline });
    const result = await callStructuredLLM(prompt, introOutroResponseSchema, (data) =>
      validateGeneratedIntroOutro(data, hostCount),
    );

    res.json({
      introOutro: {
        hooks: result.hooks.map(({ style, text }) => ({ style, text: text.trim() })),
        intro_script: result.intro_script.trim(),
        outros: result.outros.map((text) => text.trim()),
        teaser: result.teaser.trim(),
      },
    });
  }),
);

// POST /api/expand-segment  (Deep Dive)
outlineRouter.post(
  '/expand-segment',
  asyncHandler(async (req, res) => {
    const { valid, errors } = validateExpandSegmentRequest(req.body || {});
    if (!valid) throw validationError(errors);

    const { topic, tone, lengthMins, outline, segment, projectId } = req.body;
    const db = req.app.locals.db;
    const project = getOwnedProject(db, projectId, req.user?.id);

    if (project) {
      const row = db
        .prepare('SELECT content, is_stale FROM deep_dive_cache WHERE project_id = ? AND segment_id = ?')
        .get(project.id, segment.id);
      if (row && !row.is_stale) {
        return res.json({ deepDive: JSON.parse(row.content), cached: true });
      }
    } else {
      const memKey = hashKey({
        kind: 'deep-dive',
        topic,
        tone,
        segmentId: segment.id,
        segmentTitle: segment.title,
        points: segment.talking_points,
      });
      const cached = getCached(memKey);
      if (cached) return res.json({ deepDive: cached, cached: true });
      req._memCacheKey = memKey;
    }

    const prompt = buildDeepDivePrompt({ topic, tone, lengthMins, outline, segment });
    const deepDive = await callStructuredLLM(prompt, deepDiveResponseSchema, (data) => ({
      valid:
        typeof data?.notes === 'string' &&
        data.notes.trim().length > 0 &&
        Array.isArray(data?.discussion_prompts),
      errors: [{ field: 'deepDive', message: 'Expected { notes: string, discussion_prompts: string[] }.' }],
    }));

    if (project) {
      db.prepare(
        `INSERT INTO deep_dive_cache (project_id, segment_id, content, is_stale, updated_at)
         VALUES (?, ?, ?, 0, datetime('now'))
         ON CONFLICT(project_id, segment_id) DO UPDATE SET content = excluded.content, is_stale = 0, updated_at = datetime('now')`,
      ).run(project.id, segment.id, JSON.stringify(deepDive));
    } else {
      setCached(req._memCacheKey, deepDive);
    }

    res.json({ deepDive, cached: false });
  }),
);

// POST /api/guest-questions  (regenerate independently of the main outline)
outlineRouter.post(
  '/guest-questions',
  asyncHandler(async (req, res) => {
    const { valid, errors } = validateGuestQuestionsRequest(req.body || {});
    if (!valid) throw validationError(errors);

    const { topic, tone, lengthMins, guestNames, guestBio, outline } = req.body;
    const cacheKey = hashKey({ kind: 'guest-questions', topic, tone, guestNames, guestBio });
    const cached = getCached(cacheKey);
    if (cached) return res.json({ questions: cached, cached: true });

    const prompt = buildGuestQuestionsPrompt({ topic, tone, lengthMins, guestNames, guestBio, outline });
    const result = await callStructuredLLM(prompt, guestQuestionsResponseSchema, (data) => ({
      valid: Array.isArray(data?.questions) && data.questions.every((q) => typeof q === 'string'),
      errors: [{ field: 'questions', message: 'Expected { questions: string[] }.' }],
    }));

    setCached(cacheKey, result.questions);
    res.json({ questions: result.questions, cached: false });
  }),
);
