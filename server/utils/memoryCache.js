import crypto from 'node:crypto';

// Lightweight in-memory cache for LLM calls that aren't tied to a saved
// project (anonymous / localStorage-only usage). Saved-project Deep Dive
// results are cached in SQLite instead (see db/schema.sql, routes/outline.js)
// so they survive a server restart; this cache is intentionally ephemeral.
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

const store = new Map();

/** Deterministic cache key from any JSON-serializable payload. */
export function hashKey(payload) {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(stable).digest('hex');
}

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCached(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Exposed for tests that need a clean slate between runs. */
export function clearCache() {
  store.clear();
}
