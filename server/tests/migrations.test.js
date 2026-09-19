import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createDb } from '../db/init.js';
import { migrate, LATEST_SCHEMA_VERSION } from '../db/migrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseSchema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf-8');

/** A database as an older release left it: base tables and data, no comments, user_version 0. */
function legacyDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(baseSchema);
  db.prepare("INSERT INTO users (email, password_hash) VALUES ('old@example.com', 'x')").run();
  db.prepare("INSERT INTO projects (user_id, title, outline_json, share_token) VALUES (1, 'Old project', '{\"episode_title\":\"Old\"}', 'tok')").run();
  db.prepare("INSERT INTO deep_dive_cache (project_id, segment_id, content) VALUES (1, 1, '{}')").run();
  return db;
}

const columnNames = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const tableNames = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);

describe('schema migrations', () => {
  it('starts an old database at version 0 and upgrades it to the latest', () => {
    const db = legacyDb();
    expect(db.pragma('user_version', { simple: true })).toBe(0);
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_SCHEMA_VERSION);
  });

  it('adds the comments table with the expected columns', () => {
    const db = legacyDb();
    migrate(db);
    expect(tableNames(db)).toContain('comments');
    expect(columnNames(db, 'comments')).toEqual(
      expect.arrayContaining(['id', 'project_id', 'segment_id', 'author_user_id', 'body', 'created_at', 'resolved']),
    );
  });

  it('keeps existing users, projects and cached Deep Dives untouched', () => {
    const db = legacyDb();
    migrate(db);
    expect(db.prepare('SELECT title, share_token FROM projects').get()).toEqual({ title: 'Old project', share_token: 'tok' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM deep_dive_cache').get().n).toBe(1);
  });

  it('gives existing share links comments_enabled = 1 so nothing changes for old links', () => {
    const db = legacyDb();
    migrate(db);
    expect(db.prepare('SELECT comments_enabled FROM projects').get().comments_enabled).toBe(1);
  });

  it('is safe to run repeatedly', () => {
    const db = legacyDb();
    migrate(db);
    db.prepare("INSERT INTO comments (project_id, author_user_id, body) VALUES (1, 1, 'kept')").run();
    migrate(db);
    migrate(db);
    expect(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n).toBe(1);
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_SCHEMA_VERSION);
  });

  it('does not fail if the column already exists (a half-applied earlier attempt)', () => {
    const db = legacyDb();
    db.exec('ALTER TABLE projects ADD COLUMN comments_enabled INTEGER NOT NULL DEFAULT 1');
    expect(() => migrate(db)).not.toThrow();
  });

  it('createDb produces the same up-to-date schema for a brand-new database', () => {
    const db = createDb(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_SCHEMA_VERSION);
    expect(columnNames(db, 'projects')).toContain('comments_enabled');
    expect(tableNames(db)).toContain('comments');
  });

  it('cascades comment deletion when the project is deleted', () => {
    const db = legacyDb();
    migrate(db);
    db.prepare("INSERT INTO comments (project_id, author_user_id, body) VALUES (1, 1, 'gone soon')").run();
    db.prepare('DELETE FROM projects WHERE id = 1').run();
    expect(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n).toBe(0);
  });
});
