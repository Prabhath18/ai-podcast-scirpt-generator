import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { validateCredentials } from '../validators/authValidators.js';
import { signSession, setSessionCookie, clearSessionCookie, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const authRouter = Router();

const SALT_ROUNDS = 10;

function validationError(errors) {
  const error = new Error('Request failed validation.');
  error.code = 'VALIDATION_ERROR';
  error.details = errors;
  return error;
}

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const { valid, errors } = validateCredentials({ email, password });
    if (!valid) throw validationError(errors);

    const db = req.app.locals.db;
    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      const error = new Error('An account with that email already exists.');
      error.code = 'EMAIL_TAKEN';
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const insert = db
      .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(normalizedEmail, passwordHash);
    const user = { id: insert.lastInsertRowid, email: normalizedEmail };

    setSessionCookie(res, signSession(user));
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const { valid, errors } = validateCredentials({ email, password });
    if (!valid) throw validationError(errors);

    const db = req.app.locals.db;
    const normalizedEmail = email.trim().toLowerCase();
    const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(normalizedEmail);

    const invalidCredsError = () => {
      const error = new Error('Incorrect email or password.');
      error.code = 'INVALID_CREDENTIALS';
      return error;
    };

    if (!row) throw invalidCredsError();
    const matches = await bcrypt.compare(password, row.password_hash);
    if (!matches) throw invalidCredsError();

    const user = { id: row.id, email: row.email };
    setSessionCookie(res, signSession(user));
    res.json({ user });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
