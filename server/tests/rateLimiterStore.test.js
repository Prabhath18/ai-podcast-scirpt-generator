import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import express from 'express';
import request from 'supertest';
import { createRateLimiters } from '../middleware/rateLimiter.js';
import { captureLogs } from '../utils/logger.js';

// Which store do the rate limiters count in? With no REDIS_URL, express-rate-limit's in-memory store, as
// always. With REDIS_URL, Redis (shared across instances), and if Redis is unreachable, memory again with
// a warning rather than a crash. Redis here is a small fake that speaks the commands rate-limit-redis sends.

/** Enough of Redis for rate-limit-redis: SCRIPT LOAD, EVALSHA (the increment and get scripts), DECR, DEL. */
class FakeRedis extends EventEmitter {
  constructor() {
    super();
    this.calls = [];
    this.entries = new Map();
    this.failing = false;
    this.disconnected = false;
  }

  async call(...args) {
    this.calls.push(args);
    if (this.failing) throw new Error('Connection is closed.');
    const [command, ...rest] = args;
    if (command === 'SCRIPT') return rest[1].includes('INCR') ? 'sha-increment' : 'sha-get';
    if (command === 'EVALSHA') {
      const [sha, , key, , windowMs] = rest;
      const entry = this.entries.get(key);
      const live = entry && entry.expires > Date.now();
      if (sha === 'sha-get') return live ? [String(entry.hits), entry.expires - Date.now()] : [false, -2];
      if (!live) {
        this.entries.set(key, { hits: 1, expires: Date.now() + Number(windowMs) });
        return [1, Number(windowMs)];
      }
      entry.hits += 1;
      return [entry.hits, entry.expires - Date.now()];
    }
    if (command === 'DECR') {
      const entry = this.entries.get(rest[0]);
      if (entry) entry.hits -= 1;
      return entry?.hits ?? 0;
    }
    if (command === 'DEL') return this.entries.delete(rest[0]) ? 1 : 0;
    throw new Error(`FakeRedis: unexpected command ${command}`);
  }

  disconnect() {
    this.disconnected = true;
  }

  /** The rate-limit keys held, without the counters. */
  keys() {
    return [...this.entries.keys()];
  }
}

// Limiters are only counted outside NODE_ENV=test, so these tests pass their own `skip` and env.
const options = (extraEnv = {}, extra = {}) => ({ env: { NODE_ENV: 'production', ...extraEnv }, skip: () => false, ...extra });

/** An app with one route behind the limiter chosen by `pick`, e.g. (l) => l.authLimiter (10 per 15 min). */
const appWith = (limiters, pick) => {
  const app = express();
  app.use(pick(limiters), (_req, res) => res.json({ ok: true }));
  return app;
};

const hit = async (app, times) => {
  let last;
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop -- sequential, so every request reaches the same counter in order
    last = await request(app).get('/');
  }
  return last;
};

let logs;
let limitersToClose = [];
afterEach(() => {
  logs?.restore();
  logs = undefined;
  limitersToClose.forEach((limiters) => limiters.close());
  limitersToClose = [];
  vi.useRealTimers();
});

const create = (opts) => {
  const limiters = createRateLimiters(opts);
  limitersToClose.push(limiters);
  return limiters;
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('without REDIS_URL', () => {
  it('uses the in-memory store and never creates a Redis client', () => {
    const createClient = vi.fn();
    const limiters = create({ ...options({}, { createClient }) });

    expect(limiters.status()).toEqual({ store: 'memory', configured: false, connected: false });
    expect(limiters.stores).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
  });

  it('still limits, counting in memory (429 with the standard body once the limit is passed)', async () => {
    const limiters = create(options());
    const app = appWith(limiters, (l) => l.authLimiter);

    expect((await hit(app, 10)).status).toBe(200);
    const blocked = await hit(app, 1);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: expect.any(String), code: 'RATE_LIMITED' });
  });

  it('treats a blank REDIS_URL as unset', () => {
    const createClient = vi.fn();
    const limiters = create(options({ REDIS_URL: '   ' }, { createClient }));
    expect(limiters.status().configured).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('never opens Redis under NODE_ENV=test, even if REDIS_URL is set in the shell', () => {
    const createClient = vi.fn();
    const limiters = create({ env: { NODE_ENV: 'test', REDIS_URL: 'redis://localhost:6379' }, createClient });
    expect(limiters.status().configured).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('with REDIS_URL and a working Redis', () => {
  it('opens one connection with that URL and gives every limiter its own Redis-backed store', () => {
    const fake = new FakeRedis();
    const createClient = vi.fn(() => fake);

    const limiters = create(options({ REDIS_URL: 'redis://cache.internal:6379' }, { createClient }));

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith('redis://cache.internal:6379');
    expect(Object.keys(limiters.stores).sort()).toEqual(['auth', 'commentWrite', 'general', 'llm', 'research']);
  });

  it('sends no commands until the connection is ready, then counts in Redis', async () => {
    const fake = new FakeRedis();
    const limiters = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
    const app = appWith(limiters, (l) => l.llmLimiter);

    // Before "ready": served from memory, Redis untouched (rate-limit-redis would fail loading its scripts).
    expect((await hit(app, 1)).status).toBe(200);
    expect(fake.calls).toEqual([]);
    expect(limiters.status().store).toBe('memory');

    fake.emit('ready');
    expect(limiters.status()).toEqual({ store: 'redis', configured: true, connected: true });
    expect((await hit(app, 1)).status).toBe(200);

    expect(fake.calls.some(([command]) => command === 'SCRIPT')).toBe(true);
    expect(fake.keys()).toHaveLength(1);
    expect(fake.keys()[0]).toMatch(/^rl:llm:/); // each limiter has its own key prefix
  });

  it('enforces the limit through Redis and answers 429 in the standard shape', async () => {
    const fake = new FakeRedis();
    const limiters = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
    fake.emit('ready');
    const app = appWith(limiters, (l) => l.authLimiter);

    expect((await hit(app, 10)).status).toBe(200);
    const blocked = await hit(app, 1);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: expect.any(String), code: 'RATE_LIMITED' });
    expect([...fake.entries.values()][0].hits).toBe(11); // the counter lives in Redis
  });

  it('shares one budget between two server instances', async () => {
    // Two processes, one Redis: each has its own limiter objects but they count in the same place.
    const fake = new FakeRedis();
    const instanceA = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
    const instanceB = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
    fake.emit('ready');
    const appA = appWith(instanceA, (l) => l.authLimiter);
    const appB = appWith(instanceB, (l) => l.authLimiter);

    expect((await hit(appA, 5)).status).toBe(200);
    expect((await hit(appB, 5)).status).toBe(200); // 10 in total across both instances
    expect((await hit(appA, 1)).status).toBe(429);
    expect((await hit(appB, 1)).status).toBe(429);
  });

  it('keeps the limiters separate: exhausting one does not touch another', async () => {
    const fake = new FakeRedis();
    const limiters = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
    fake.emit('ready');
    const authApp = appWith(limiters, (l) => l.authLimiter);
    const researchApp = appWith(limiters, (l) => l.researchLimiter);

    expect((await hit(authApp, 11)).status).toBe(429);
    expect((await hit(researchApp, 1)).status).toBe(200);
  });
});

describe('when Redis cannot be reached', () => {
  it('falls back to memory with a warning and keeps limiting: a connection error is not a crash', async () => {
    logs = captureLogs('warn');
    const fake = new FakeRedis();
    const limiters = create(options({ REDIS_URL: 'redis://down:6379' }, { createClient: () => fake }));
    const app = appWith(limiters, (l) => l.authLimiter);

    // ioredis reports an unreachable server as an 'error' event (it would crash the process with no listener).
    fake.emit('error', Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6379'), { code: 'ECONNREFUSED' }));

    expect((await hit(app, 10)).status).toBe(200);
    expect((await hit(app, 1)).status).toBe(429); // still limited, in memory
    expect(fake.calls).toEqual([]);
    const warnings = logs.lines.filter((line) => line.level === 40 && /Redis is unavailable/.test(line.msg));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].msg).toMatch(/per server instance in memory/);
    expect(warnings[0].err.code).toBe('ECONNREFUSED');
  });

  it('warns once per outage, not once per error', async () => {
    logs = captureLogs('warn');
    const fake = new FakeRedis();
    create(options({ REDIS_URL: 'redis://down' }, { createClient: () => fake }));

    for (let i = 0; i < 5; i++) fake.emit('error', new Error('connect ECONNREFUSED'));

    expect(logs.lines.filter((line) => /Redis is unavailable/.test(line.msg))).toHaveLength(1);
  });

  it('falls back when the client cannot even be created (a malformed URL), and says so', async () => {
    logs = captureLogs('warn');
    const limiters = create(options({ REDIS_URL: 'not a url' }, { createClient: () => { throw new Error('Invalid URL'); } }));
    const app = appWith(limiters, (l) => l.llmLimiter);

    expect((await hit(app, 1)).status).toBe(200);
    expect(limiters.status().connected).toBe(false);
    expect(logs.lines.some((line) => /check REDIS_URL/.test(line.msg))).toBe(true);
  });

  it('falls back when Redis fails partway through, then returns to Redis once it recovers', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    logs = captureLogs('warn');
    const fake = new FakeRedis();
    const limiters = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
    fake.emit('ready');
    const app = appWith(limiters, (l) => l.llmLimiter);

    expect((await hit(app, 1)).status).toBe(200); // counted in Redis
    fake.failing = true;
    expect((await hit(app, 1)).status).toBe(200); // the command throws: served from memory, request not failed
    expect(logs.lines.some((line) => /A Redis command failed/.test(line.msg))).toBe(true);

    fake.calls.length = 0;
    expect((await hit(app, 1)).status).toBe(200);
    expect(fake.calls).toEqual([]); // still backing off: not retrying Redis on every request

    fake.failing = false;
    vi.setSystemTime(Date.now() + 6000); // past the back-off
    expect((await hit(app, 1)).status).toBe(200);
    expect(fake.calls.length).toBeGreaterThan(0); // Redis again
  });

  it('goes back to Redis by itself when the connection returns', async () => {
    const fake = new FakeRedis();
    const limiters = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
    fake.emit('ready');
    fake.emit('error', new Error('connection lost'));
    expect(limiters.status().store).toBe('memory');

    fake.emit('ready');
    await flush();

    expect(limiters.status().store).toBe('redis');
  });

  it('never leaves an unhandled rejection behind when Redis is down at start-up', async () => {
    const rejections = [];
    const onRejection = (reason) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      const fake = new FakeRedis();
      fake.failing = true;
      const limiters = create(options({ REDIS_URL: 'redis://x' }, { createClient: () => fake }));
      fake.emit('ready'); // a connection that says ready, then rejects every command
      const app = appWith(limiters, (l) => l.generalLimiter);

      expect((await hit(app, 3)).status).toBe(200);
      await flush();
      await flush();
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(rejections).toEqual([]);
  });
});

describe('the exported limiters', () => {
  it('are the same five names the routes already import, and report their store', async () => {
    const module = await import('../middleware/rateLimiter.js');
    for (const name of ['generalLimiter', 'llmLimiter', 'authLimiter', 'researchLimiter', 'commentWriteLimiter']) {
      expect(typeof module[name]).toBe('function');
    }
    expect(module.rateLimitStatus()).toEqual({ store: 'memory', configured: false, connected: false });
  });
});
