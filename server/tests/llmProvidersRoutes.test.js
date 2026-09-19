import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { chatResponse, errorResponse, isolateLlmEnv, neverAnswers } from './llmTestUtils.js';

// Same idea as llmProviders.test.js, one level up: the real Express routes and llmHelper.js run,
// only the Gemini module and Hugging Face's HTTP endpoint are fakes. No route, prompt or
// validator is changed by provider support, and these tests prove that by using them as-is.
vi.mock('../services/llm/gemini.js', () => ({ generateWithGemini: vi.fn(), GEMINI_MODEL: 'test-gemini-model' }));
import { generateWithGemini } from '../services/llm/gemini.js';

const outline = (overrides = {}) => ({
  episode_title: 'Open Model Episode',
  tone: 'Educational',
  total_duration_mins: 30,
  intro: 'Hi there.',
  segments: Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    title: `Segment ${i + 1}`,
    talking_points: ['a', 'b', 'c'],
    duration_mins: 6,
    transition: 'next...',
  })),
  guest_questions: [],
  outro: 'Bye.',
  ...overrides,
});
const OUTLINE_JSON = JSON.stringify(outline());
const brief = { topic: 'AI in education', tone: 'Educational', lengthMins: 30, hostCount: 'solo' };

let app;
let restoreEnv;
let fetchMock;

beforeEach(() => {
  restoreEnv = isolateLlmEnv();
  ({ app } = createTestApp());
  generateWithGemini.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  restoreEnv();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const useHuggingFace = (extra = {}) => Object.assign(process.env, { LLM_PROVIDER: 'huggingface', HF_TOKEN: 'hf_test_token', ...extra });
const generateOutline = () => request(app).post('/api/generate-outline').send(brief);
const answers = (...contents) => contents.forEach((content) => fetchMock.mockImplementationOnce(async () => chatResponse(content)));

describe('the default (Gemini) path is untouched', () => {
  it('generates an outline through Gemini with no Hugging Face request', async () => {
    generateWithGemini.mockResolvedValue(OUTLINE_JSON);
    const res = await generateOutline();
    expect(res.status).toBe(201);
    expect(res.body.outline.episode_title).toBe('Open Model Episode');
    expect(generateWithGemini).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still retries once on invalid JSON, and reports LLM_INVALID_RESPONSE when it stays invalid', async () => {
    generateWithGemini.mockResolvedValue('still not json');
    const res = await generateOutline();
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_INVALID_RESPONSE');
    expect(generateWithGemini).toHaveBeenCalledTimes(2);
  });

  it('still reports a provider error with no code as LLM_INVALID_RESPONSE after one retry', async () => {
    generateWithGemini.mockRejectedValue(Object.assign(new Error('models/x is not found'), { status: 404 }));
    const res = await generateOutline();
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_INVALID_RESPONSE');
    expect(res.body.error).toContain('models/x is not found');
    expect(generateWithGemini).toHaveBeenCalledTimes(2);
  });
});

describe('Hugging Face through the real routes', () => {
  it('generates a validated, duration-normalized outline', async () => {
    useHuggingFace();
    answers(OUTLINE_JSON);
    const res = await generateOutline();
    expect(res.status).toBe(201);
    expect(res.body.outline.segments).toHaveLength(5);
    expect(res.body.outline.segments.reduce((sum, s) => sum + s.duration_mins, 0)).toBe(30);
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it('asks for the JSON Schema of the outline in the prompt, without changing the route\'s own prompt', async () => {
    useHuggingFace();
    answers(OUTLINE_JSON);
    await generateOutline();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const user = body.messages[1].content;
    expect(user).toContain('Podcast topic: AI in education'); // the untouched route prompt
    expect(user).toContain('Generate a complete episode outline as JSON');
    expect(user).toContain('JSON Schema:');
    expect(user).toContain('"episode_title"');
    expect(user).toContain('"talking_points"');
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  describe('JSON that arrives wrapped in something', () => {
    it.each([
      ['a ```json fence', '```json\n' + OUTLINE_JSON + '\n```'],
      ['a bare ``` fence', '```\n' + OUTLINE_JSON + '\n```'],
      ['prose before and after', `Sure, here is the outline:\n\n${OUTLINE_JSON}\n\nLet me know if you'd like changes!`],
      ['a fence with prose around it', `Here you go.\n\`\`\`json\n${OUTLINE_JSON}\n\`\`\`\nEnjoy the show.`],
      ['a reasoning block first', `<think>I should plan five segments {maybe six}.</think>\n${OUTLINE_JSON}`],
      ['stray braces in the prose', `Use {curly} braces like so: ${OUTLINE_JSON}`],
    ])('is parsed when wrapped in %s, with no retry', async (_name, content) => {
      useHuggingFace();
      answers(content);
      const res = await generateOutline();
      expect(res.status).toBe(201);
      expect(res.body.outline.episode_title).toBe('Open Model Episode');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('the single retry works the same as for Gemini', () => {
    it('retries once when the reply is not JSON at all, feeding the error back', async () => {
      useHuggingFace();
      answers('I would be happy to help with that outline!', OUTLINE_JSON);
      const res = await generateOutline();
      expect(res.status).toBe(201);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const retryPrompt = JSON.parse(fetchMock.mock.calls[1][1].body).messages[1].content;
      expect(retryPrompt).toContain('Your previous response was invalid');
    });

    it('retries once when the JSON fails validation (only three segments), then succeeds', async () => {
      useHuggingFace();
      answers(JSON.stringify(outline({ segments: outline().segments.slice(0, 3) })), OUTLINE_JSON);
      const res = await generateOutline();
      expect(res.status).toBe(201);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages[1].content).toMatch(/segments must contain between 5 and 8/);
    });

    it('gives up after one retry with LLM_INVALID_RESPONSE when the model keeps failing validation', async () => {
      useHuggingFace();
      fetchMock.mockImplementation(async () => chatResponse('```json\n{"episode_title": "Only a title"}\n```'));
      const res = await generateOutline();
      expect(res.status).toBe(502);
      expect(res.body.code).toBe('LLM_INVALID_RESPONSE');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('other routes work through the same adapter', () => {
    it('guest questions', async () => {
      useHuggingFace();
      answers('Here are the questions: {"questions": ["What is jazz?", "Who invented it?"]}');
      const res = await request(app).post('/api/guest-questions').send({ topic: 'Jazz', tone: 'Educational', outline: outline() });
      expect(res.status).toBe(200);
      expect(res.body.questions).toEqual(['What is jazz?', 'Who invented it?']);
    });

    it('variations (several outlines in one reply)', async () => {
      useHuggingFace();
      const raw = (approach) => {
        const o = outline({ episode_title: `Title: ${approach}` });
        return { approach, rationale: 'Because.', episode_title: o.episode_title, intro: o.intro, segments: o.segments, guest_questions: [], outro: o.outro };
      };
      answers('```json\n' + JSON.stringify({ variations: [raw('Chronological story'), raw('Myth-busting')] }) + '\n```');
      const res = await request(app).post('/api/generate-variations').send({ ...brief, count: 2 });
      expect(res.status).toBe(201);
      expect(res.body.variations).toHaveLength(2);
      expect(res.body.skipped).toBe(0);
    });
  });
});

describe('Hugging Face failures reach the client with a clear code', () => {
  it('a timeout is 504 LLM_TIMEOUT, and is not retried (a second wait would double the delay)', async () => {
    useHuggingFace({ HF_TIMEOUT_MS: '40' });
    fetchMock = neverAnswers();
    vi.stubGlobal('fetch', fetchMock);
    const res = await generateOutline();
    expect(res.status).toBe(504);
    expect(res.body.code).toBe('LLM_TIMEOUT');
    expect(res.body.error).toMatch(/did not answer within/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a rate limit is 429 LLM_RATE_LIMITED, not retried', async () => {
    useHuggingFace();
    fetchMock.mockImplementation(async () => errorResponse(429, 'slow down'));
    const res = await generateOutline();
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LLM_RATE_LIMITED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('used-up credits (402) are reported as a limit, with the fix in the message', async () => {
    useHuggingFace();
    fetchMock.mockImplementation(async () => errorResponse(402));
    const res = await generateOutline();
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LLM_RATE_LIMITED');
    expect(res.body.error).toMatch(/credits/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a rejected token is 502 LLM_AUTH naming HF_TOKEN, not retried', async () => {
    useHuggingFace();
    fetchMock.mockImplementation(async () => errorResponse(401));
    const res = await generateOutline();
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_AUTH');
    expect(res.body.error).toContain('HF_TOKEN');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a server error (503) is retried once, then reported as 502 LLM_PROVIDER_ERROR', async () => {
    useHuggingFace();
    fetchMock.mockImplementation(async () => errorResponse(503, 'overloaded'));
    const res = await generateOutline();
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_PROVIDER_ERROR');
    expect(res.body.error).toContain('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a hiccup on the first call is absorbed by the retry', async () => {
    useHuggingFace();
    fetchMock.mockImplementationOnce(async () => errorResponse(503)).mockImplementationOnce(async () => chatResponse(OUTLINE_JSON));
    const res = await generateOutline();
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a missing token is 503 LLM_NOT_CONFIGURED naming HF_TOKEN, with no request made', async () => {
    process.env.LLM_PROVIDER = 'huggingface';
    const res = await generateOutline();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('LLM_NOT_CONFIGURED');
    expect(res.body.error).toContain('HF_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an unknown LLM_PROVIDER is 503 LLM_NOT_CONFIGURED listing the valid options', async () => {
    process.env.LLM_PROVIDER = 'openai';
    const res = await generateOutline();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('LLM_NOT_CONFIGURED');
    expect(res.body.error).toContain('Valid options: gemini, huggingface');
  });

  it('a missing Gemini key still names GEMINI_API_KEY (the real Gemini module)', async () => {
    const actual = await vi.importActual('../services/llm/gemini.js');
    generateWithGemini.mockImplementation(actual.generateWithGemini);
    const res = await generateOutline();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('LLM_NOT_CONFIGURED');
    expect(res.body.error).toContain('GEMINI_API_KEY');
  });
});

describe('fallback through the real routes', () => {
  it('Hugging Face fails, Gemini answers: the user still gets an outline', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    fetchMock.mockImplementation(async () => errorResponse(429));
    generateWithGemini.mockResolvedValue(OUTLINE_JSON);
    const res = await generateOutline();
    expect(res.status).toBe(201);
    expect(res.body.outline.episode_title).toBe('Open Model Episode');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateWithGemini).toHaveBeenCalledTimes(1);
  });

  it('Gemini fails, Hugging Face answers', async () => {
    process.env.LLM_FALLBACK_PROVIDER = 'huggingface';
    process.env.HF_TOKEN = 'hf_test_token';
    generateWithGemini.mockRejectedValue(new Error('quota exceeded'));
    answers('```json\n' + OUTLINE_JSON + '\n```');
    const res = await generateOutline();
    expect(res.status).toBe(201);
  });

  it('both fail: the existing { error, code } shape, with both reasons in the message', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    fetchMock.mockImplementation(async () => errorResponse(401));
    generateWithGemini.mockRejectedValue(new Error('gemini down'));
    const res = await generateOutline();
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ code: 'LLM_AUTH' });
    expect(res.body.error).toContain('HF_TOKEN');
    expect(res.body.error).toContain('fallback provider (gemini) also failed: gemini down');
    expect(Object.keys(res.body).sort()).toEqual(['code', 'error']); // exactly the app's error shape
  });

  it('a fallback equal to the primary is reported as a configuration error', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'huggingface' });
    const res = await generateOutline();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('LLM_NOT_CONFIGURED');
    expect(res.body.error).toMatch(/must be different/);
  });
});
