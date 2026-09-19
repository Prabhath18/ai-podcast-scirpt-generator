// Where the rate limiters keep their counters.
//
// By default that is express-rate-limit's in-memory store: nothing to set up, but each server
// instance counts on its own. Set REDIS_URL and the counters live in Redis instead, so several
// instances share one budget per client.
//
// Redis is optional at run time as well as at set-up time. If it cannot be reached (bad URL,
// server down, connection lost), each limiter falls back to an in-memory store, logs one clear
// warning, and goes back to Redis by itself once the connection recovers. A Redis outage can
// therefore make limits per-instance for a while; it can never take the API down.
import { MemoryStore } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import { logger as defaultLogger } from '../utils/logger.js';

const RETRY_REDIS_AFTER_MS = 5000; // after a failed command, use memory for this long before trying Redis again
const WARN_EVERY_MS = 60_000; // one warning per outage, repeated at most this often

/** How the real client is created. Tests pass their own. */
function createIoRedisClient(url) {
  return new Redis(url, {
    // Fail fast instead of queueing commands while disconnected: a request must not hang on Redis.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: (attempt) => Math.min(attempt * 500, 15_000),
  });
}

/**
 * One connection to Redis, shared by every limiter, plus the bookkeeping for "is it usable now".
 * Never throws: a failure to even create the client is logged and leaves `usable()` false.
 */
export function createRedisBackend({ url, createClient = createIoRedisClient, logger = defaultLogger }) {
  let client = null;
  let ready = false;
  let failedUntil = 0;
  let lastWarning = 0;

  const warn = (message, err) => {
    const now = Date.now();
    if (now - lastWarning < WARN_EVERY_MS) return;
    lastWarning = now;
    logger.warn(
      { err: err && { message: err.message, code: err.code } },
      `${message} Rate limits are counted per server instance in memory until Redis is reachable again.`,
    );
  };

  try {
    client = createClient(url);
    client.on('ready', () => {
      ready = true;
      failedUntil = 0;
      lastWarning = 0;
      logger.info('Redis connected: rate limits are now shared across server instances.');
    });
    // An 'error' event with no listener would crash the process, so always listen.
    client.on('error', (err) => {
      ready = false;
      warn('Redis is unavailable.', err);
    });
    client.on('close', () => {
      if (ready) warn('The Redis connection closed.');
      ready = false;
    });
  } catch (err) {
    client = null;
    warn('Could not set up the Redis connection (check REDIS_URL).', err);
  }

  return {
    /** True when Redis should be tried for the next command. */
    usable: () => Boolean(client) && ready && Date.now() >= failedUntil,
    /** Records a failed command: use memory for a few seconds, then try Redis again. */
    markFailed(err) {
      failedUntil = Date.now() + RETRY_REDIS_AFTER_MS;
      warn('A Redis command failed.', err);
    },
    sendCommand: (...args) => client.call(...args),
    status: () => ({ configured: true, connected: Boolean(client) && ready }),
    close: () => client?.disconnect?.(),
  };
}

/**
 * A rate-limit store that prefers Redis and quietly falls back to memory. It implements the
 * store interface express-rate-limit calls (init, get, increment, decrement, resetKey).
 * The Redis side is created only once the connection is ready: rate-limit-redis sends commands
 * from its constructor, which would fail (and reject unhandled) against a connection that is down.
 */
export class ResilientStore {
  constructor({ backend, prefix }) {
    this.backend = backend;
    this.prefix = prefix;
    this.memory = new MemoryStore();
    this.redis = null;
    this.options = null;
    // The memory store keeps per-client timers; the Redis store does not.
    this.localKeys = true;
  }

  init(options) {
    this.options = options;
    this.memory.init(options);
  }

  /** The store to use for this command, or null to use memory. */
  #redisStore() {
    if (!this.backend.usable()) return null;
    if (!this.redis) {
      const store = new RedisStore({ sendCommand: this.backend.sendCommand, prefix: this.prefix });
      store.init(this.options);
      // The constructor starts two SCRIPT LOADs; a failure is retried on the next command, so silence the rejection.
      store.incrementScriptSha?.catch?.(() => {});
      store.getScriptSha?.catch?.(() => {});
      this.redis = store;
    }
    return this.redis;
  }

  async #run(method, key) {
    const redis = this.#redisStore();
    if (redis) {
      try {
        return await redis[method](key);
      } catch (err) {
        this.backend.markFailed(err);
      }
    }
    return this.memory[method](key);
  }

  get(key) {
    return this.#run('get', key);
  }

  increment(key) {
    return this.#run('increment', key);
  }

  decrement(key) {
    return this.#run('decrement', key);
  }

  resetKey(key) {
    return this.#run('resetKey', key);
  }

  /** Which store the next command would use; for tests and the startup log. */
  activeStore() {
    return this.backend.usable() ? 'redis' : 'memory';
  }
}
