// Loaded by vitest before every test file (see vitest.config.js). Keeps
// tests independent of a real .env so `npm test` works with no setup.
process.env.JWT_SECRET = 'test-only-secret';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
