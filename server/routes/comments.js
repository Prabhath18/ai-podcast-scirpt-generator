// Comments on an episode (segment_id NULL) or on one segment. One handler set
// serves two entry points, each of which resolves the project first and
// attaches `req.commentAccess = { project, isOwner }`:
//   /api/projects/:id/comments        the owner, via their own project
//   /api/shared/:token/comments       any signed-in user, if the owner left comments on
// Who may do what:
//   read + post     the owner and any signed-in user with access
//   resolve         the owner only
//   delete          the owner (any comment) or the comment's author (their own)
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { commentWriteLimiter } from '../middleware/rateLimiter.js';

const MAX_COMMENT_LENGTH = 1000;

export const commentsRouter = Router({ mergeParams: true });

function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** "maya.lee@example.com" -> "maya.lee". The email itself is never sent to other users. */
function displayName(email) {
  return String(email).split('@')[0];
}

function toCommentDto(row, viewerId) {
  return {
    id: row.id,
    segmentId: row.segment_id,
    body: row.body,
    createdAt: row.created_at,
    resolved: Boolean(row.resolved),
    author: { name: displayName(row.email) },
    isMine: row.author_user_id === viewerId,
  };
}

function loadComment(db, projectId, rawId) {
  const id = Number(rawId);
  const row = Number.isInteger(id)
    ? db
        .prepare(
          `SELECT c.*, u.email FROM comments c JOIN users u ON u.id = c.author_user_id
           WHERE c.id = ? AND c.project_id = ?`,
        )
        .get(id, projectId)
    : null;
  if (!row) throw apiError('NOT_FOUND', 'Comment not found.');
  return row;
}

commentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { project } = req.commentAccess;
    const rows = req.app.locals.db
      .prepare(
        `SELECT c.*, u.email FROM comments c JOIN users u ON u.id = c.author_user_id
         WHERE c.project_id = ? ORDER BY c.created_at ASC, c.id ASC`,
      )
      .all(project.id);
    res.json({ comments: rows.map((row) => toCommentDto(row, req.user.id)) });
  }),
);

commentsRouter.post(
  '/',
  commentWriteLimiter,
  asyncHandler(async (req, res) => {
    const { project } = req.commentAccess;
    const { body, segmentId = null } = req.body || {};

    const text = typeof body === 'string' ? body.trim() : '';
    if (!text || text.length > MAX_COMMENT_LENGTH) {
      const error = apiError('VALIDATION_ERROR', 'Request failed validation.');
      error.details = [{ field: 'body', message: `A comment must be 1 to ${MAX_COMMENT_LENGTH} characters.` }];
      throw error;
    }

    if (segmentId !== null) {
      const segments = JSON.parse(project.outline_json).segments || [];
      if (!Number.isInteger(segmentId) || !segments.some((s) => s.id === segmentId)) {
        const error = apiError('VALIDATION_ERROR', 'Request failed validation.');
        error.details = [{ field: 'segmentId', message: 'segmentId must be null or the id of a segment in this outline.' }];
        throw error;
      }
    }

    const db = req.app.locals.db;
    const result = db
      .prepare('INSERT INTO comments (project_id, segment_id, author_user_id, body) VALUES (?, ?, ?, ?)')
      .run(project.id, segmentId, req.user.id, text);
    const row = loadComment(db, project.id, result.lastInsertRowid);
    res.status(201).json({ comment: toCommentDto(row, req.user.id) });
  }),
);

commentsRouter.patch(
  '/:commentId',
  asyncHandler(async (req, res) => {
    const { project, isOwner } = req.commentAccess;
    const db = req.app.locals.db;
    const row = loadComment(db, project.id, req.params.commentId);
    if (!isOwner) throw apiError('FORBIDDEN', 'Only the episode owner can resolve comments.');

    if (typeof req.body?.resolved !== 'boolean') {
      const error = apiError('VALIDATION_ERROR', 'Request failed validation.');
      error.details = [{ field: 'resolved', message: 'resolved must be true or false.' }];
      throw error;
    }
    db.prepare('UPDATE comments SET resolved = ? WHERE id = ?').run(req.body.resolved ? 1 : 0, row.id);
    res.json({ comment: toCommentDto({ ...row, resolved: req.body.resolved ? 1 : 0 }, req.user.id) });
  }),
);

commentsRouter.delete(
  '/:commentId',
  asyncHandler(async (req, res) => {
    const { project, isOwner } = req.commentAccess;
    const db = req.app.locals.db;
    const row = loadComment(db, project.id, req.params.commentId);
    if (!isOwner && row.author_user_id !== req.user.id) {
      throw apiError('FORBIDDEN', 'You can only delete your own comments.');
    }
    db.prepare('DELETE FROM comments WHERE id = ?').run(row.id);
    res.status(204).end();
  }),
);

/** Entry point 1: the signed-in owner, addressing their project by id. */
export function resolveOwnedProject(req, _res, next) {
  const project = req.app.locals.db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!project) return next(apiError('NOT_FOUND', 'Project not found.'));
  req.commentAccess = { project, isOwner: true };
  return next();
}

/** Entry point 2: any signed-in user holding a valid share token, if comments are switched on. */
export function resolveSharedProject(req, _res, next) {
  const project = req.app.locals.db.prepare('SELECT * FROM projects WHERE share_token = ?').get(req.params.token);
  if (!project) return next(apiError('NOT_FOUND', 'This share link is invalid or has been revoked.'));
  if (!project.comments_enabled) return next(apiError('COMMENTS_DISABLED', 'Comments are turned off for this shared link.'));
  req.commentAccess = { project, isOwner: project.user_id === req.user.id };
  return next();
}
