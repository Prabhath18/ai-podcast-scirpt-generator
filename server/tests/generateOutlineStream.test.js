import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { captureLogs } from '../utils/logger.js';

// The real route, validation, retry and post-processing, with the provider layer (services/llm.js) replaced by
// scripted models: generateStream "writes" text chunk by chunk, exactly as a streaming provider would.
vi.mock('../services/llm.js', () => ({
  generate: vi.fn(),
  generateStream: vi.fn(),
  GEMINI_MODEL: 'test-model',
}));
import { generate, generateStream } from '../services/llm.js';

const BRIEF = { topic: 'How lighthouses work', tone: 'Educational', lengthMins: 40, hostCount: 'solo' };

const segment = (n) => ({ id: n * 10, title: `Segment ${n}`, talking_points: ['a', 'b', 'c'], duration_mins: 6, transition: `On to part ${n + 1}.` });
const outline = (overrides = {}) => ({
  episode_title: 'Mocked Episode',
  tone: 'Educational',
  total_duration_mins: 30,
  intro: 'Hi there.',
  segments: [1, 2, 3, 4, 5].map(segment),
  guest_questions: [],
  outro: 'Bye.',
  ...overrides,
});
const OUTLINE_JSON = JSON.stringify(outline());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const codeError = (code, message = `${code} happened`) => Object.assign(new Error(message), { code });

/** A model that writes `text` in `pieces` chunks, `gapMs` apart (longer than the route's progress throttle). */
const writing =
  (text, { pieces = 6, gapMs = 0 } = {}) =>
  async (_prompt, _schema, onChunk) => {
    const size = Math.ceil(text.length / pieces);
    for (let i = 0; i < text.length; i += size) {
      // eslint-disable-next-line no-await-in-loop -- chunks arrive one after another
      if (gapMs) await sleep(gapMs);
      onChunk(text.slice(i, i + size));
    }
    return text;
  };

// supertest only buffers types it knows; take the raw text of an event stream.
const asText = (res, done) => {
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => done(null, data));
};
const parseSse = (text) =>
  text
    .split('\n\n')
    .filter((block) => block.trim() && !block.startsWith(':'))
    .map((block) => ({ event: block.match(/^event: (.+)$/m)?.[1], data: JSON.parse(block.match(/^data: (.+)$/m)?.[1]) }));
const post = (app, body = BRIEF) => request(app).post('/api/generate-outline/stream').send(body).buffer(true).parse(asText);
const eventsOf = (res) => parseSse(res.body);
const names = (events) => events.map((e) => e.event);

let app;
let logs;
beforeEach(() => {
  ({ app } = createTestApp());
  generate.mockReset();
  generateStream.mockReset();
  logs = captureLogs('info');
});
afterEach(() => logs.restore());

describe('POST /api/generate-outline/stream: the stream', () => {
  it('opens an event stream with the headers that keep proxies from buffering it', async () => {
    generateStream.mockImplementation(writing(OUTLINE_JSON));

    const res = await post(app);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('sends start, real progress events that only move forward, then the finished outline last', async () => {
    generateStream.mockImplementation(writing(OUTLINE_JSON, { pieces: 8, gapMs: 140 }));

    const events = eventsOf(await post(app));

    expect(events[0]).toEqual({ event: 'start', data: {} });
    expect(events.at(-1).event).toBe('result');
    expect(names(events).filter((n) => n === 'result')).toHaveLength(1);
    expect(names(events).filter((n) => n === 'error')).toHaveLength(0);

    const progress = events.filter((e) => e.event === 'progress').map((e) => e.data);
    expect(progress.length).toBeGreaterThanOrEqual(3); // the text arrived over ~1 s, so this is not a single lump
    for (const p of progress) {
      expect(p).toEqual({ stage: expect.any(String), fraction: expect.any(Number), segmentsDrafted: expect.any(Number), segmentsExpected: expect.any(Number), chars: expect.any(Number) });
      expect(p.fraction).toBeLessThanOrEqual(0.95);
    }
    expect(progress.map((p) => p.fraction)).toEqual([...progress.map((p) => p.fraction)].sort((a, b) => a - b));
    expect(progress.map((p) => p.chars)).toEqual([...progress.map((p) => p.chars)].sort((a, b) => a - b));
    expect(progress.at(-1).segmentsDrafted).toBeGreaterThan(progress[0].segmentsDrafted); // real structure, not a timer
  });

  it('reports the model\'s actual structure: segments drafted so far', async () => {
    // The first burst ends right after the fourth segment's last field ("On to part 5." bridges segment 4 to 5).
    const text = OUTLINE_JSON;
    const cut = text.indexOf('"transition":"On to part 5."') + '"transition":"On to part 5."'.length;
    generateStream.mockImplementation(async (_p, _s, onChunk) => {
      onChunk(text.slice(0, cut));
      await sleep(150);
      onChunk(text.slice(cut));
      return text;
    });

    const events = eventsOf(await post(app));

    const first = events.find((e) => e.event === 'progress');
    expect(first.data).toMatchObject({ stage: 'segments', segmentsDrafted: 4, segmentsExpected: 7 }); // 40 minutes: about 7
  });

  it('coalesces a burst of tokens into a few progress events instead of one per token', async () => {
    generateStream.mockImplementation(writing(OUTLINE_JSON, { pieces: OUTLINE_JSON.length })); // one character at a time, no pause

    const events = eventsOf(await post(app));

    expect(events.filter((e) => e.event === 'progress').length).toBeLessThanOrEqual(3);
    expect(events.at(-1).event).toBe('result');
  });
});

describe('POST /api/generate-outline/stream: the result is the same as the plain route\'s', () => {
  it('returns the identical outline (ids renumbered, durations rescaled to the requested length)', async () => {
    generate.mockResolvedValue(OUTLINE_JSON);
    generateStream.mockImplementation(writing(OUTLINE_JSON));

    const plain = await request(app).post('/api/generate-outline').send(BRIEF);
    const streamed = eventsOf(await post(app)).at(-1);

    expect(plain.status).toBe(201);
    expect(streamed.event).toBe('result');
    expect(streamed.data).toEqual(plain.body);
    expect(streamed.data.outline.segments.map((s) => s.id)).toEqual([1, 2, 3, 4, 5]); // model sent 10, 20, ...
    expect(streamed.data.outline.segments.reduce((sum, s) => sum + s.duration_mins, 0)).toBe(40);
    expect(streamed.data.outline.total_duration_mins).toBe(40);
  });

  it('builds the same prompt and uses the same response schema as the plain route', async () => {
    generate.mockResolvedValue(OUTLINE_JSON);
    generateStream.mockImplementation(writing(OUTLINE_JSON));
    const guest = { ...BRIEF, includeGuests: true, guestNames: 'Dr. Okafor', guestBio: 'lighthouse keeper', podcastName: 'Night Signal' };

    await request(app).post('/api/generate-outline').send(guest);
    await post(app, guest);

    expect(generateStream.mock.calls[0][0]).toBe(generate.mock.calls[0][0]); // prompt
    expect(generateStream.mock.calls[0][1]).toBe(generate.mock.calls[0][1]); // schema
    expect(generateStream.mock.calls[0][0]).toContain('Dr. Okafor');
  });

  it('applies the same validation: a broken outline never reaches the client as a result', async () => {
    generateStream.mockImplementation(writing(JSON.stringify({ episode_title: 'Only a title' })));

    const events = eventsOf(await post(app));

    expect(names(events)).not.toContain('result');
    const error = events.at(-1);
    expect(error.event).toBe('error');
    expect(error.data.code).toBe('LLM_INVALID_RESPONSE');
    expect(error.data.details).toBeDefined();
  });
});

describe('POST /api/generate-outline/stream: retry and fallback', () => {
  it('retries once through the same pipeline: tells the client it is starting over, then delivers the corrected outline', async () => {
    generateStream.mockImplementationOnce(writing('{"episode_title":"Broken"}')).mockImplementationOnce(writing(OUTLINE_JSON));

    const events = eventsOf(await post(app));

    expect(generateStream).toHaveBeenCalledTimes(2);
    expect(generateStream.mock.calls[1][0]).toContain('IMPORTANT: Your previous response was invalid'); // the same feedback prompt
    const retrying = events.find((e) => e.event === 'progress' && e.data.stage === 'retrying');
    expect(retrying.data).toMatchObject({ reason: 'retry', fraction: 0, segmentsDrafted: 0, chars: 0 });
    expect(events.at(-1).event).toBe('result');
    expect(events.indexOf(retrying)).toBeLessThan(events.length - 1);
  });

  it('tells the client when the text restarts because a fallback provider took over', async () => {
    generateStream.mockImplementation(async (_p, _s, onChunk, options) => {
      onChunk('{"episode_title":"Half');
      options.onRestart({ reason: 'fallback', provider: 'gemini' });
      onChunk(OUTLINE_JSON);
      return OUTLINE_JSON;
    });

    const events = eventsOf(await post(app));

    expect(events.some((e) => e.event === 'progress' && e.data.stage === 'retrying' && e.data.reason === 'fallback')).toBe(true);
    expect(events.at(-1).event).toBe('result');
  });
});

describe('POST /api/generate-outline/stream: errors', () => {
  it('answers a request that fails validation as ordinary JSON 400, not a stream, and never calls the model', async () => {
    const res = await request(app).post('/api/generate-outline/stream').send({ tone: 'Educational' });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Request failed validation.', code: 'VALIDATION_ERROR', details: expect.any(Array) });
    expect(generateStream).not.toHaveBeenCalled();
  });

  it('applies exactly the same field rules as the plain route', async () => {
    const bad = { ...BRIEF, lengthMins: 3 };
    const plain = await request(app).post('/api/generate-outline').send(bad);
    const streamed = await request(app).post('/api/generate-outline/stream').send(bad);

    expect(streamed.status).toBe(plain.status);
    expect(streamed.body).toEqual(plain.body);
  });

  it.each([
    ['LLM_TIMEOUT', 'The model took too long.'],
    ['LLM_RATE_LIMITED', 'Rate limit reached.'],
    ['LLM_AUTH', 'Bad token.'],
    ['LLM_NOT_CONFIGURED', 'GEMINI_API_KEY is not configured on the server.'],
  ])('reports %s as an error event with the usual { error, code } body', async (code, message) => {
    generateStream.mockImplementation(async (_p, _s, onChunk) => {
      onChunk('{"episode_title":"Half');
      throw codeError(code, message);
    });

    const res = await post(app);
    const events = eventsOf(res);

    expect(res.status).toBe(200); // the stream was already open, so the status cannot change
    expect(events.at(-1)).toEqual({ event: 'error', data: { error: message, code } });
    expect(names(events)).not.toContain('result');
  });

  it('logs the failure and the stream\'s outcome under the request id', async () => {
    generateStream.mockRejectedValue(codeError('LLM_AUTH', 'Bad token.'));

    const res = await post(app);

    const finished = logs.lines.find((line) => line.event === 'outline_stream');
    expect(finished).toMatchObject({ outcome: 'LLM_AUTH', reqId: res.headers['x-request-id'] });
    expect(typeof finished.durationMs).toBe('number');
  });

  it('reports an unexpected crash as an error event too, and logs it at error level', async () => {
    generateStream.mockRejectedValue(new TypeError('cannot read properties of undefined'));

    const events = eventsOf(await post(app));

    expect(events.at(-1).event).toBe('error');
    expect(events.at(-1).data.code).toBe('LLM_INVALID_RESPONSE'); // llmHelper's rule for a code-less failure, as on the plain route
    expect(logs.lines.some((line) => line.msg === 'request failed' && line.level === 50)).toBe(true);
  });
});

describe('POST /api/generate-outline/stream: the client goes away', () => {
  let server;
  afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

  /** Opens the stream over a real socket, resolves with the first bytes, and hands back the request so the test can hang up. */
  const openStream = () =>
    new Promise((resolve, reject) => {
      server = http.createServer(app).listen(0, () => {
        const req = http.request(
          { port: server.address().port, path: '/api/generate-outline/stream', method: 'POST', headers: { 'Content-Type': 'application/json' } },
          (res) => {
            res.setEncoding('utf8');
            res.once('data', (first) => resolve({ req, res, first }));
          },
        );
        req.on('error', () => {}); // destroying the request is the point of the test
        req.on('error', reject);
        req.end(JSON.stringify(BRIEF));
      });
    });

  it('aborts the model call instead of paying for an outline nobody is waiting for', async () => {
    let seenSignal;
    generateStream.mockImplementation(async (_p, _s, onChunk, options) => {
      seenSignal = options.signal;
      onChunk('{"episode_title":"Half');
      await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(codeError('LLM_ABORTED', 'The request was cancelled.'))));
    });

    const { req, first } = await openStream();
    expect(first).toContain('event: start');
    expect(seenSignal.aborted).toBe(false);

    req.destroy(); // the tab closed, or "New Podcast" was clicked

    await vi.waitFor(() => expect(seenSignal.aborted).toBe(true));
    await vi.waitFor(() => expect(logs.lines.some((line) => line.event === 'outline_stream' && line.outcome === 'client_disconnected')).toBe(true));
    expect(generateStream).toHaveBeenCalledTimes(1); // and no retry was attempted
  });
});

describe('POST /api/generate-outline/stream: rate limiting', () => {
  let previousEnv;
  beforeEach(() => {
    previousEnv = process.env.NODE_ENV;
  });
  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it('shares the LLM limiter (12 a minute per IP) with the plain route, so streaming is no way around it', async () => {
    process.env.NODE_ENV = 'development'; // the limiters are skipped under NODE_ENV=test
    let last;
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop -- every request must reach the same counter
      last = await request(app).post('/api/generate-outline').send({});
    }
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      last = await request(app).post('/api/generate-outline/stream').send({});
    }
    expect(last.status).toBe(400); // 12 requests so far, all under the limit

    const blocked = await request(app).post('/api/generate-outline/stream').send({});

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: expect.any(String), code: 'RATE_LIMITED' });
  });
});
