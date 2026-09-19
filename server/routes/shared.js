import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { commentsRouter, resolveSharedProject } from './comments.js';

export const sharedRouter = Router();

sharedRouter.use('/:token/comments', requireAuth, resolveSharedProject, commentsRouter);

// GET /api/shared/:token -- read-only, no login required. Deliberately
// returns only what a viewer needs (title + outline), never the owner's
// email or internal project id. `viewerIsOwner` lets the page offer owner-only
// actions; the routes still enforce ownership on their own.
sharedRouter.get(
  '/:token',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const row = db
      .prepare('SELECT title, outline_json, updated_at, comments_enabled, user_id FROM projects WHERE share_token = ?')
      .get(req.params.token);

    if (!row) {
      const error = new Error('This share link is invalid or has been revoked.');
      error.code = 'NOT_FOUND';
      throw error;
    }

    res.json({
      title: row.title,
      outline: JSON.parse(row.outline_json),
      updatedAt: row.updated_at,
      commentsEnabled: Boolean(row.comments_enabled),
      viewerIsOwner: req.user?.id === row.user_id,
    });
  }),
);
