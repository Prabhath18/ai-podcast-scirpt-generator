import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { createApp, parseTrustProxy } from '../app.js';
import { createDb } from '../db/init.js';
import { captureLogs, logger } from '../utils/logger.js';
import { isolateLlmEnv } from './llmTestUtils.js';

// The real router (services/llm.js) runs; only the Gemini SDK wrapper is replaced, so the LLM-call log
// lines under test come from the same code that runs in production.
vi.mock('../services/llm/gemini.js', () => ({
  generateWithGemini: vi.fn(),
  streamWithGemini: vi.fn(),
  GEMINI_MODEL: 'test-gemini-model',
}));

import { generateWithGemini } from '../services/llm/gemini.js';

const BRIEF = { topic: 'Lighthouses', tone: 'Educational', lengthMins: 30, hostCount: 'solo' };
const OUTLINE = {
  episode_title: 'Lighthouses',
  tone: 'Educational',
  total_duration_mins: 30,
  intro: 'Hello.',
  segments: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, title: `Part ${i + 1}`, talking_points: ['a', 'b', 'c'], duration_mins: 6, transition: 'Next.' })),
  guest_questions: [],
  outro: 'Goodbye.',
};

let logs;
let restoreEnv;
let app;

beforeEach(() => {
  restoreEnv = isolateLlmEnv();
  process.env.GEMINI_API_KEY = 'test-key';
  ({ app } = createTestApp());
  generateWithGemini.mockReset();
  logs = captureLogs('debug');
});
afterEach(() => {
  logs.restore();
  restoreEnv();
});

const linesFor = (reqId) => logs.lines.filter((line) => line.reqId === reqId);
const byEvent = (event) => logs.lines.filter((line) => line.event === event);

describe('request ids', () => {
  it('gives every response an X-Request-Id, and a different one each time', async () => {
    const first = await request(app).get('/api/health');
    const second = await request(app).get('/api/health');

    expect(first.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.headers['x-request-id']).not.toBe(first.headers['x-request-id']);
  });

  it('is present on error responses too, but never inside the { error, code } body', async () => {
    const res = await request(app).post('/api/generate-outline').send({ tone: 'Educational' });

    expect(res.status).toBe(400);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(Object.keys(res.body).sort()).toEqual(['code', 'details', 'error']);
    expect(JSON.stringify(res.body)).not.toContain(res.headers['x-request-id']);
  });

  it('keeps an id a proxy already assigned, when it is short and plain', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'edge-7f3a9c21-req');
    expect(res.headers['x-request-id']).toBe('edge-7f3a9c21-req');
  });

  it.each([['too short', 'abc'], ['spaces', 'not a valid id at all'], ['markup', '<script>alert(1)</script>'], ['too long', 'x'.repeat(200)]])(
    'replaces an id that is %s, so a caller cannot forge log lines',
    async (_name, badId) => {
      const res = await request(app).get('/api/health').set('X-Request-Id', badId);
      expect(res.headers['x-request-id']).not.toBe(badId);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

describe('the access log', () => {
  it('writes one line per request with its id, method, path, status and duration', async () => {
    const res = await request(app).post('/api/generate-outline').send({ tone: 'Educational' });

    const [line] = logs.lines.filter((l) => l.msg === 'request' && l.reqId === res.headers['x-request-id']);
    expect(line).toMatchObject({ level: 30, method: 'POST', path: '/api/generate-outline', status: 400, service: 'podcast-outline-api' });
    expect(typeof line.durationMs).toBe('number');
    expect(line.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logs the full path even for routes inside a mounted router (not just "/me")', async () => {
    const res = await request(app).get('/api/auth/me');
    const [line] = logs.lines.filter((l) => l.msg === 'request' && l.reqId === res.headers['x-request-id']);
    expect(line.path).toBe('/api/auth/me');
  });

  it('logs health checks at debug, so they do not drown the rest at the default level', async () => {
    const res = await request(app).get('/api/health');
    const [line] = logs.lines.filter((l) => l.msg === 'request' && l.reqId === res.headers['x-request-id']);
    expect(line.level).toBe(20); // debug
  });

  it('does not log the query string (it can hold search text)', async () => {
    const res = await request(app).get('/api/research?q=private+search');
    const [line] = logs.lines.filter((l) => l.msg === 'request' && l.reqId === res.headers['x-request-id']);
    expect(line.path).toBe('/api/research');
    expect(JSON.stringify(logs.lines)).not.toContain('private+search');
  });
});

describe('LLM call logs', () => {
  it('records provider, model, duration and outcome, tagged with the request that caused the call', async () => {
    generateWithGemini.mockResolvedValue(JSON.stringify(OUTLINE));

    const res = await request(app).post('/api/generate-outline').send(BRIEF);

    expect(res.status).toBe(201);
    const [call] = byEvent('llm_call');
    expect(call).toMatchObject({ provider: 'gemini', model: 'test-gemini-model', streaming: false, outcome: 'ok' });
    expect(typeof call.durationMs).toBe('number');
    expect(call.reqId).toBe(res.headers['x-request-id']); // the id from the response header, found in the LLM log
  });

  it('records a failed call with its error code, and the same request id as the access log line', async () => {
    generateWithGemini.mockRejectedValue(Object.assign(new Error('Gemini did not answer.'), { code: 'LLM_TIMEOUT' }));

    const res = await request(app).post('/api/generate-outline').send(BRIEF);

    expect(res.status).toBe(504);
    const id = res.headers['x-request-id'];
    const [call] = byEvent('llm_call');
    expect(call).toMatchObject({ outcome: 'error', code: 'LLM_TIMEOUT', level: 40, reqId: id });
    expect(linesFor(id).map((l) => l.msg)).toEqual(expect.arrayContaining(['LLM call failed', 'request failed', 'request']));
  });

  it('keeps concurrent requests apart: each LLM log line carries its own request id', async () => {
    generateWithGemini.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return JSON.stringify(OUTLINE);
    });

    const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).post('/api/generate-outline').send(BRIEF)));

    const ids = responses.map((r) => r.headers['x-request-id']);
    expect(new Set(ids).size).toBe(4);
    expect(byEvent('llm_call').map((l) => l.reqId).sort()).toEqual([...ids].sort());
  });

  it('logs when the fallback provider is used', async () => {
    process.env.LLM_PROVIDER = 'huggingface';
    process.env.HF_TOKEN = 'hf_test';
    process.env.LLM_FALLBACK_PROVIDER = 'gemini';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"down"}', { status: 503, headers: { 'content-type': 'application/json' } })));
    generateWithGemini.mockResolvedValue(JSON.stringify(OUTLINE));
    try {
      const res = await request(app).post('/api/generate-outline').send(BRIEF);

      expect(res.status).toBe(201);
      expect(byEvent('llm_fallback')[0]).toMatchObject({ from: 'huggingface', to: 'gemini', reqId: res.headers['x-request-id'] });
      expect(byEvent('llm_call').map((l) => `${l.provider}:${l.outcome}`)).toEqual(['huggingface:error', 'gemini:ok']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the error handler', () => {
  it('logs a server failure at error level with the error, status, code and request id', async () => {
    generateWithGemini.mockRejectedValue(new Error('provider blew up')); // no code: retried, then LLM_INVALID_RESPONSE (502)

    const res = await request(app).post('/api/generate-outline').send(BRIEF);

    expect(res.status).toBe(502);
    const [failure] = logs.lines.filter((l) => l.msg === 'request failed');
    expect(failure).toMatchObject({ level: 50, reqId: res.headers['x-request-id'], method: 'POST', path: '/api/generate-outline', status: 502, code: 'LLM_INVALID_RESPONSE' });
    expect(failure.err).toMatchObject({ type: 'Error', message: expect.stringContaining('provider blew up') });
    expect(failure.err.stack).toContain('llmHelper');
  });

  it('does not log ordinary client errors (400, 401, 404) as errors', async () => {
    await request(app).post('/api/generate-outline').send({});
    await request(app).get('/api/auth/me');
    await request(app).get('/api/no-such-route');

    expect(logs.lines.filter((l) => l.level >= 50)).toEqual([]);
  });
});

describe('the logger', () => {
  it('redacts cookies and authorization headers even if a caller logs them by mistake', () => {
    logger.info({ headers: { cookie: 'podcast_session=secret-token', authorization: 'Bearer secret-token', accept: 'json' } }, 'oops');

    const [line] = logs.lines.filter((l) => l.msg === 'oops');
    expect(line.headers).toEqual({ cookie: '[redacted]', authorization: '[redacted]', accept: 'json' });
    expect(JSON.stringify(line)).not.toContain('secret-token');
  });

  it('writes nothing at all under NODE_ENV=test unless a test turns it on', () => {
    const lines = [];
    const capture = captureLogs('silent');
    logger.error('this should not appear');
    lines.push(...capture.lines);
    capture.restore();
    expect(lines).toEqual([]);
  });
});

describe('TRUST_PROXY', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['FALSE', false],
    ['true', true],
    ['1', 1],
    ['2', 2],
    ['loopback', 'loopback'],
    ['10.0.0.0/8, 172.16.0.0/12', '10.0.0.0/8, 172.16.0.0/12'],
  ])('parses %j as %j', (raw, expected) => {
    expect(parseTrustProxy(raw)).toBe(expected);
  });

  it('is off by default, so X-Forwarded-For cannot be used to dodge the rate limits', async () => {
    delete process.env.TRUST_PROXY;
    const plain = createApp(createDb(':memory:'));
    expect(plain.get('trust proxy')).toBe(false);

    const res = await request(plain).get('/api/health').set('X-Forwarded-For', '203.0.113.9');

    const [line] = logs.lines.filter((l) => l.msg === 'request' && l.reqId === res.headers['x-request-id']);
    expect(line.ip).not.toContain('203.0.113.9'); // the header is ignored: the address is the connection's own
  });

  it('makes the app read the visitor address from X-Forwarded-For when set (the address the limiters count by)', async () => {
    process.env.TRUST_PROXY = '1';
    try {
      const proxied = createApp(createDb(':memory:'));
      expect(proxied.get('trust proxy')).toBe(1);

      const res = await request(proxied).get('/api/health').set('X-Forwarded-For', '203.0.113.9');

      const [line] = logs.lines.filter((l) => l.msg === 'request' && l.reqId === res.headers['x-request-id']);
      expect(line.ip).toBe('203.0.113.9');
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });
});
