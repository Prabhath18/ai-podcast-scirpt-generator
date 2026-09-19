import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Opens (and creates, if missing) the SQLite database at `databasePath`,
 * applies the schema, and returns a ready-to-use better-sqlite3 instance.
 *
 * Kept as a factory rather than a module-level singleton so tests can spin
 * up isolated, disposable databases (see server/tests/testDb.js).
 */
export function createDb(databasePath) {
  // ':memory:' is better-sqlite3's own sentinel for an ephemeral in-RAM
  // database (used by the test suite) -- it must be passed through as-is,
  // never resolved as a filesystem path.
  const isInMemory = databasePath === ':memory:';
  const resolvedPath = isInMemory ? databasePath : path.resolve(databasePath);

  if (!isInMemory) {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  return db;
}
