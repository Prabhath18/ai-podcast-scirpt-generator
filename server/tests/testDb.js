import { createDb } from '../db/init.js';
import { createApp } from '../app.js';

/** Fresh in-memory SQLite DB + Express app per test, so tests never touch a real data file or share state. */
export function createTestApp() {
  const db = createDb(':memory:');
  const app = createApp(db);
  return { app, db };
}
