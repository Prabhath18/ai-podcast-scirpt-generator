import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export const sharedRouter = Router();

// GET /api/shared/:token -- read-only, no login required. Deliberately
// returns only what a viewer needs (title + outline), never the owner's
// email or internal project id.
sharedRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const db = req.app.locals.db;
    const row = db
      .prepare('SELECT title, outline_json, updated_at FROM projects WHERE share_token = ?')
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
    });
  }),
);
