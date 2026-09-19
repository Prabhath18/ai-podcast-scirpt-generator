import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'podcast_session';

export function signSession(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

// In development the Vite dev server proxies /api to this server, so the
// browser only ever sees one origin and a Lax cookie is enough. In a real
// deployment the frontend (e.g. Vercel) and backend (e.g. Railway/Render)
// are on different domains, which is a cross-site request as far as the
// browser is concerned -- that requires SameSite=None, and browsers refuse
// SameSite=None without Secure, so both flip together based on NODE_ENV.
const isProd = () => process.env.NODE_ENV === 'production';

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/', sameSite: isProd() ? 'none' : 'lax', secure: isProd() });
}

function readUserFromRequest(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** Attaches req.user when a valid session cookie is present; never rejects. */
export function optionalAuth(req, _res, next) {
  req.user = readUserFromRequest(req);
  next();
}

/** Rejects with 401 when there is no valid session. */
export function requireAuth(req, res, next) {
  const user = readUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'You must be logged in to do that.', code: 'UNAUTHENTICATED' });
  }
  req.user = user;
  next();
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
