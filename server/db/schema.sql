-- Schema for the AI Podcast Script and Episode Outline Generator.
-- Applied idempotently on every server start (see db/init.js).

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  outline_json TEXT NOT NULL,
  share_token  TEXT UNIQUE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token);

-- Deep Dive responses are cached per project + segment so reopening a saved
-- project doesn't re-spend an LLM call. `is_stale` is set to 1 whenever the
-- segment's title/talking points change so the UI knows to regenerate.
CREATE TABLE IF NOT EXISTS deep_dive_cache (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  segment_id INTEGER NOT NULL,
  content    TEXT NOT NULL,
  is_stale   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, segment_id)
);
