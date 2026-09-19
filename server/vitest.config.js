import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Deep dive/guest-question tests share the in-memory rate limiter and
    // cache modules; running files in sequence keeps their per-IP counters
    // and cache entries from bleeding across unrelated test files.
    fileParallelism: false,
  },
});
