// Versioned schema changes applied on top of schema.sql. SQLite's built-in
// `PRAGMA user_version` stores how many have run, so every migration runs
// exactly once and a database created by an older release upgrades in place
// without losing data. schema.sql stays the v0 baseline (users, projects,
// deep_dive_cache); anything added later lives here.

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

const MIGRATIONS = [
  // 1: comments on segments + a per-share-link comments switch.
  (db) => {
    if (!hasColumn(db, 'projects', 'comments_enabled')) {
      db.exec('ALTER TABLE projects ADD COLUMN comments_enabled INTEGER NOT NULL DEFAULT 1');
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        segment_id     INTEGER,
        author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body           TEXT NOT NULL,
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        resolved       INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id, segment_id);
    `);
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

export function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      MIGRATIONS[version](db);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
