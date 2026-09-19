import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { validateOutline } from '../validators/outlineSchema.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

function validationError(errors) {
  const error = new Error('Request failed validation.');
  error.code = 'VALIDATION_ERROR';
  error.details = errors;
  return error;
}

function notFound() {
  const error = new Error('Project not found.');
  error.code = 'NOT_FOUND';
  return error;
}

function toProjectDto(row) {
  return {
    id: row.id,
    title: row.title,
    outline: JSON.parse(row.outline_json),
    shareToken: row.share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadOwnedProject(db, id, userId) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) throw notFound();
  return row;
}

/**
 * Marks any cached Deep Dive entries stale when their segment's content
 * changed, and drops cache rows for segments that no longer exist -- called
 * whenever a project's outline is saved with edits.
 */
function reconcileDeepDiveCache(db, projectId, previousOutline, nextOutline) {
  const previousById = new Map((previousOutline.segments || []).map((s) => [s.id, s]));
  const nextIds = new Set((nextOutline.segments || []).map((s) => s.id));

  for (const segment of nextOutline.segments || []) {
    const prev = previousById.get(segment.id);
    if (!prev) continue;
    const changed =
      prev.title !== segment.title || JSON.stringify(prev.talking_points) !== JSON.stringify(segment.talking_points);
    if (changed) {
      db.prepare('UPDATE deep_dive_cache SET is_stale = 1 WHERE project_id = ? AND segment_id = ?').run(
        projectId,
        segment.id,
      );
    }
  }

  const staleRows = db.prepare('SELECT segment_id FROM deep_dive_cache WHERE project_id = ?').all(projectId);
  for (const row of staleRows) {
    if (!nextIds.has(row.segment_id)) {
      db.prepare('DELETE FROM deep_dive_cache WHERE project_id = ? AND segment_id = ?').run(projectId, row.segment_id);
    }
  }
}

// GET /api/projects
projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const rows = db
      .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
      .all(req.user.id);
    res.json({ projects: rows.map(toProjectDto) });
  }),
);

// POST /api/projects
projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, outline } = req.body || {};
    if (typeof title !== 'string' || !title.trim()) {
      throw validationError([{ field: 'title', message: 'Title is required.' }]);
    }
    const { valid, errors } = validateOutline(outline);
    if (!valid) throw validationError(errors);

    const db = req.app.locals.db;
    const result = db
      .prepare('INSERT INTO projects (user_id, title, outline_json) VALUES (?, ?, ?)')
      .run(req.user.id, title.trim(), JSON.stringify(outline));

    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ project: toProjectDto(row) });
  }),
);

// GET /api/projects/:id
projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const row = loadOwnedProject(db, req.params.id, req.user.id);
    res.json({ project: toProjectDto(row) });
  }),
);

// PUT /api/projects/:id
projectsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const existing = loadOwnedProject(db, req.params.id, req.user.id);

    const { title, outline } = req.body || {};
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      throw validationError([{ field: 'title', message: 'Title must be a non-empty string.' }]);
    }
    if (outline !== undefined) {
      const { valid, errors } = validateOutline(outline);
      if (!valid) throw validationError(errors);
      reconcileDeepDiveCache(db, existing.id, JSON.parse(existing.outline_json), outline);
    }

    db.prepare(
      `UPDATE projects SET title = COALESCE(?, title), outline_json = COALESCE(?, outline_json), updated_at = datetime('now') WHERE id = ?`,
    ).run(title?.trim() ?? null, outline ? JSON.stringify(outline) : null, existing.id);

    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(existing.id);
    res.json({ project: toProjectDto(row) });
  }),
);

// DELETE /api/projects/:id
projectsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    loadOwnedProject(db, req.params.id, req.user.id); // throws NOT_FOUND if not owned
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.status(204).end();
  }),
);

// POST /api/projects/:id/share -- (re)generates a share token for this project.
projectsRouter.post(
  '/:id/share',
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const existing = loadOwnedProject(db, req.params.id, req.user.id);
    const token = existing.share_token || crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE projects SET share_token = ? WHERE id = ?').run(token, existing.id);
    res.json({ shareToken: token });
  }),
);

// DELETE /api/projects/:id/share -- revokes the share link.
projectsRouter.delete(
  '/:id/share',
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const existing = loadOwnedProject(db, req.params.id, req.user.id);
    db.prepare('UPDATE projects SET share_token = NULL WHERE id = ?').run(existing.id);
    res.status(204).end();
  }),
);
