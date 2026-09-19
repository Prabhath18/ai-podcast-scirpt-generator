import { Router } from 'express';
import { callStructuredLLM } from '../services/llmHelper.js';
import { buildOutlinePrompt } from '../prompts/outlinePrompt.js';
import { buildDeepDivePrompt } from '../prompts/deepDivePrompt.js';
import { buildGuestQuestionsPrompt } from '../prompts/guestQuestionsPrompt.js';
import { outlineResponseSchema, deepDiveResponseSchema, guestQuestionsResponseSchema } from '../prompts/schemas.js';
import { validateOutline } from '../validators/outlineSchema.js';
import {
  validateOutlineRequest,
  validateExpandSegmentRequest,
  validateGuestQuestionsRequest,
} from '../validators/requestValidators.js';
import { normalizeDurations } from '../utils/duration.js';
import { getCached, setCached, hashKey } from '../utils/memoryCache.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { llmLimiter } from '../middleware/rateLimiter.js';

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

// POST /api/generate-outline
outlineRouter.post(
  '/generate-outline',
  asyncHandler(async (req, res) => {
    const { valid, errors } = validateOutlineRequest(req.body || {});
    if (!valid) throw validationError(errors);

    const { topic, tone, podcastName, hostCount, lengthMins, includeGuests, guestNames, guestBio } = req.body;

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

    const outline = await callStructuredLLM(prompt, outlineResponseSchema, validateOutline);

    // Renumber segment ids 1..N and rescale durations so they always sum to
    // the requested length, regardless of what the model actually returned.
    outline.segments = outline.segments.map((segment, index) => ({ ...segment, id: index + 1 }));
    outline.segments = normalizeDurations(outline.segments, Number(lengthMins));
    outline.total_duration_mins = Number(lengthMins);

    res.status(201).json({ outline });
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
