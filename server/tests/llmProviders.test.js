import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bodyOfCall, chatResponse, errorResponse, isolateLlmEnv, neverAnswers } from './llmTestUtils.js';
import { guestQuestionsResponseSchema } from '../prompts/schemas.js';
import { captureLogs } from '../utils/logger.js';

// The Gemini SDK is replaced; the router (services/llm.js) and the Hugging Face adapter are real,
// and Hugging Face's HTTP endpoint is a fetch mock. Nothing here touches the network.
vi.mock('../services/llm/gemini.js', () => ({
  generateWithGemini: vi.fn(),
  GEMINI_MODEL: 'test-gemini-model',
}));

import { generateWithGemini } from '../services/llm/gemini.js';
import { PROVIDER_NAMES, describeLlmConfig, generate, resolveProviders } from '../services/llm.js';
import { DEFAULT_HF_MODEL, buildHuggingFacePrompt } from '../services/llm/huggingface.js';

let restoreEnv;
let fetchMock;
let logs; // the server's structured log, collected (the fallback notice is a warn-level log line)

beforeEach(() => {
  restoreEnv = isolateLlmEnv();
  generateWithGemini.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  logs = captureLogs('warn');
});
afterEach(() => {
  logs.restore();
  restoreEnv();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const useHuggingFace = (extra = {}) => Object.assign(process.env, { LLM_PROVIDER: 'huggingface', HF_TOKEN: 'hf_test_token', ...extra });

describe('provider selection', () => {
  it('defaults to Gemini when LLM_PROVIDER is not set', async () => {
    generateWithGemini.mockResolvedValue('gemini text');
    expect(await generate('prompt', guestQuestionsResponseSchema)).toBe('gemini text');
    expect(generateWithGemini).toHaveBeenCalledWith('prompt', guestQuestionsResponseSchema);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses Gemini when LLM_PROVIDER=gemini, and does not touch Hugging Face', async () => {
    process.env.LLM_PROVIDER = 'gemini';
    generateWithGemini.mockResolvedValue('gemini text');
    await generate('prompt');
    expect(generateWithGemini).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses Hugging Face when LLM_PROVIDER=huggingface, and does not touch Gemini', async () => {
    useHuggingFace();
    fetchMock.mockResolvedValue(chatResponse('{"questions":["q"]}'));
    expect(await generate('prompt', guestQuestionsResponseSchema)).toBe('{"questions":["q"]}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it('ignores case and surrounding spaces, and treats an empty value as unset', () => {
    process.env.LLM_PROVIDER = '  HuggingFace ';
    expect(resolveProviders().primary).toBe('huggingface');
    process.env.LLM_PROVIDER = '   ';
    expect(resolveProviders().primary).toBe('gemini');
  });

  it('supports exactly Gemini and Hugging Face', () => {
    expect(PROVIDER_NAMES).toEqual(['gemini', 'huggingface']);
  });

  it('reads the environment on every call, so a changed setting takes effect', async () => {
    generateWithGemini.mockResolvedValue('g');
    fetchMock.mockResolvedValue(chatResponse('h'));
    await generate('p');
    useHuggingFace();
    await generate('p');
    expect(generateWithGemini).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('configuration errors', () => {
  it('rejects an unknown LLM_PROVIDER with LLM_NOT_CONFIGURED and lists the valid options', async () => {
    process.env.LLM_PROVIDER = 'llama-cpp';
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('LLM_PROVIDER');
    expect(error.message).toContain('"llama-cpp"');
    expect(error.message).toContain('gemini, huggingface');
    expect(generateWithGemini).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not support OpenAI, and says so the same way', async () => {
    process.env.LLM_PROVIDER = 'openai';
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('Valid options: gemini, huggingface');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown LLM_FALLBACK_PROVIDER', async () => {
    process.env.LLM_FALLBACK_PROVIDER = 'openai';
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('LLM_FALLBACK_PROVIDER');
    expect(error.message).toContain('gemini, huggingface');
  });

  it('rejects a fallback that is the same as the primary', async () => {
    process.env.LLM_PROVIDER = 'huggingface';
    process.env.LLM_FALLBACK_PROVIDER = 'huggingface';
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toMatch(/must be different/);
    // "same as the default" counts too
    process.env.LLM_PROVIDER = '';
    process.env.LLM_FALLBACK_PROVIDER = 'gemini';
    expect((await generate('p').catch((e) => e)).message).toMatch(/must be different/);
  });

  it('names HF_TOKEN when Hugging Face is selected without one, and makes no request', async () => {
    process.env.LLM_PROVIDER = 'huggingface';
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('HF_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a blank HF_TOKEN as missing', async () => {
    useHuggingFace({ HF_TOKEN: '   ' });
    expect((await generate('p').catch((e) => e)).message).toContain('HF_TOKEN');
  });

  it('names GEMINI_API_KEY when Gemini is selected without a key (the real Gemini module)', async () => {
    const actual = await vi.importActual('../services/llm/gemini.js');
    const error = await actual.generateWithGemini('p').catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('GEMINI_API_KEY');
  });
});

describe('describeLlmConfig (the startup report)', () => {
  it('reports the default, and each missing key as a problem rather than an exception', () => {
    expect(describeLlmConfig()).toEqual({
      primary: 'gemini',
      fallback: null,
      model: 'test-gemini-model',
      problems: ['GEMINI_API_KEY is not set (needed for the gemini provider).'],
    });
  });

  it('reports Hugging Face with its model, and both providers\' missing keys when a fallback is set', () => {
    process.env.LLM_PROVIDER = 'huggingface';
    process.env.LLM_FALLBACK_PROVIDER = 'gemini';
    const report = describeLlmConfig();
    expect(report.primary).toBe('huggingface');
    expect(report.fallback).toBe('gemini');
    expect(report.model).toBe(DEFAULT_HF_MODEL);
    expect(report.problems).toHaveLength(2);
    expect(report.problems.join(' ')).toMatch(/HF_TOKEN.*GEMINI_API_KEY/);
  });

  it('has no problems when the selected provider is fully configured', () => {
    useHuggingFace({ HF_MODEL: 'org/some-model' });
    expect(describeLlmConfig()).toMatchObject({ primary: 'huggingface', model: 'org/some-model', problems: [] });
  });

  it('turns a bad setting into a problem, not a crash', () => {
    process.env.LLM_PROVIDER = 'openai';
    const report = describeLlmConfig();
    expect(report.primary).toBeNull();
    expect(report.problems[0]).toContain('Valid options: gemini, huggingface');
  });
});

describe('Hugging Face request shape', () => {
  const schema = guestQuestionsResponseSchema;
  const call = async (prompt = 'Write questions about jazz.', extra = {}) => {
    useHuggingFace(extra);
    fetchMock.mockResolvedValue(chatResponse('{"questions":["q"]}'));
    await generate(prompt, schema);
    return { url: fetchMock.mock.calls[0][0], options: fetchMock.mock.calls[0][1], body: bodyOfCall(fetchMock) };
  };

  it('POSTs to the router\'s OpenAI-compatible chat completions endpoint with a Bearer token', async () => {
    const { url, options } = await call();
    expect(url).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer hf_test_token');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends the model, a system and a user message, JSON mode, and sampling limits', async () => {
    const { body } = await call();
    expect(body.model).toBe(DEFAULT_HF_MODEL);
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(body.messages[0].content).toMatch(/exactly one JSON object/);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.4);
    expect(body.max_tokens).toBe(6000);
  });

  it('puts the original prompt, the JSON Schema (lowercase types) and an example in the user message', async () => {
    const { body } = await call('Write questions about jazz.');
    const user = body.messages[1].content;
    expect(user).toContain('Write questions about jazz.');
    expect(user).toContain('JSON Schema:');
    expect(user).toContain('"type": "object"');
    expect(user).toContain('"required": [');
    expect(user).not.toMatch(/"OBJECT"|"ARRAY"|"STRING"/);
    expect(user).toContain('{"questions":["string"]}'); // the example
  });

  it('uses HF_MODEL as given, including a routing suffix', async () => {
    const { body } = await call('p', { HF_MODEL: 'meta-llama/Llama-3.1-8B-Instruct:nscale' });
    expect(body.model).toBe('meta-llama/Llama-3.1-8B-Instruct:nscale');
  });

  it('honors HF_BASE_URL (and a trailing slash) and HF_MAX_TOKENS', async () => {
    const { url, body } = await call('p', { HF_BASE_URL: 'https://my-proxy.example.com/v1/', HF_MAX_TOKENS: '1234' });
    expect(url).toBe('https://my-proxy.example.com/v1/chat/completions');
    expect(body.max_tokens).toBe(1234);
  });

  it('ignores a nonsense HF_MAX_TOKENS or HF_TIMEOUT_MS', async () => {
    const { body } = await call('p', { HF_MAX_TOKENS: 'lots', HF_TIMEOUT_MS: '-5' });
    expect(body.max_tokens).toBe(6000);
  });

  it('trims the token', async () => {
    const { options } = await call('p', { HF_TOKEN: '  hf_padded  ' });
    expect(options.headers.Authorization).toBe('Bearer hf_padded');
  });

  it('with no schema, sends the prompt as written and does not ask for JSON mode', async () => {
    useHuggingFace();
    fetchMock.mockResolvedValue(chatResponse('plain text'));
    await generate('Just say hello.');
    const body = bodyOfCall(fetchMock);
    expect(body.messages[1].content).toBe('Just say hello.');
    expect(body.response_format).toBeUndefined();
  });

  it('builds the same prompt text from a helper (so its content is testable on its own)', () => {
    expect(buildHuggingFacePrompt('P', undefined)).toBe('P');
    expect(buildHuggingFacePrompt('P', schema)).toMatch(/^P\n\nReply with a single JSON object/);
  });

  it('returns the message content, joining a content array of text parts', async () => {
    useHuggingFace();
    fetchMock.mockResolvedValue(chatResponse([{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }]));
    expect(await generate('p', schema)).toBe('{"a":1}');
  });
});

describe('JSON mode is optional', () => {
  const schema = guestQuestionsResponseSchema;

  it('sends the request again without response_format when the provider rejects it (400)', async () => {
    useHuggingFace();
    fetchMock.mockResolvedValueOnce(errorResponse(400, "response_format is not supported by this provider")).mockResolvedValueOnce(chatResponse('{"questions":[]}'));
    expect(await generate('p', schema)).toBe('{"questions":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOfCall(fetchMock, 0).response_format).toEqual({ type: 'json_object' });
    expect(bodyOfCall(fetchMock, 1).response_format).toBeUndefined();
    expect(bodyOfCall(fetchMock, 1).messages[1].content).toContain('JSON Schema:'); // the schema is still in the prompt
  });

  it('does the same for 422', async () => {
    useHuggingFace();
    fetchMock.mockResolvedValueOnce(errorResponse(422)).mockResolvedValueOnce(chatResponse('{}'));
    await generate('p', schema);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after that one extra try if the plain request fails too', async () => {
    useHuggingFace();
    fetchMock.mockImplementation(async () => errorResponse(400, 'bad request')); // a fresh Response per call: bodies can be read once
    const error = await generate('p', schema).catch((e) => e);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).toContain('HTTP 400');
    expect(error.message).toContain('bad request');
  });

  it('does not resend for other errors', async () => {
    useHuggingFace();
    fetchMock.mockResolvedValue(errorResponse(503));
    await generate('p', schema).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Hugging Face failures are classified by cause', () => {
  const failWith = async (response) => {
    useHuggingFace({ HF_MODEL: 'org/missing-model' });
    fetchMock.mockResolvedValue(response);
    return generate('p', guestQuestionsResponseSchema).catch((e) => e);
  };

  it.each([
    [401, 'LLM_AUTH', /HF_TOKEN.*Make calls to Inference Providers/],
    [403, 'LLM_AUTH', /HF_TOKEN/],
    [402, 'LLM_RATE_LIMITED', /credits are used up.*LLM_PROVIDER=gemini/],
    [429, 'LLM_RATE_LIMITED', /rate limit/i],
    [404, 'LLM_PROVIDER_ERROR', /"org\/missing-model".*HF_MODEL/],
    [500, 'LLM_PROVIDER_ERROR', /HTTP 500/],
    [503, 'LLM_PROVIDER_ERROR', /HTTP 503/],
  ])('HTTP %i becomes %s', async (status, code, message) => {
    const error = await failWith(errorResponse(status, 'upstream detail'));
    expect(error.code).toBe(code);
    expect(error.message).toMatch(message);
  });

  it('includes the provider\'s own explanation when it gives one', async () => {
    expect((await failWith(errorResponse(500, 'model overloaded'))).message).toContain('model overloaded');
  });

  it('copes with a non-JSON error page', async () => {
    const error = await failWith(new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).toContain('HTTP 502');
  });

  it('reports a network failure as LLM_PROVIDER_ERROR', async () => {
    useHuggingFace();
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).toMatch(/Could not reach Hugging Face.*fetch failed/);
  });

  it.each([
    ['no choices', {}],
    ['empty content', { choices: [{ message: { content: '' } }] }],
    ['blank content', { choices: [{ message: { content: '   ' } }] }],
    ['null content', { choices: [{ message: { content: null } }] }],
  ])('reports %s as LLM_EMPTY_RESPONSE', async (_name, body) => {
    const error = await failWith(new Response(JSON.stringify(body), { status: 200 }));
    expect(error.code).toBe('LLM_EMPTY_RESPONSE');
  });
});

describe('timeouts', () => {
  it('aborts a request that does not answer and reports LLM_TIMEOUT clearly', async () => {
    useHuggingFace({ HF_TIMEOUT_MS: '40' });
    fetchMock = neverAnswers();
    vi.stubGlobal('fetch', fetchMock);

    const started = Date.now();
    const error = await generate('p').catch((e) => e);

    expect(error.code).toBe('LLM_TIMEOUT');
    expect(error.message).toMatch(/did not answer within 1 second/);
    expect(error.message).toMatch(/cold-starting/);
    expect(error.message).toContain('HF_TIMEOUT_MS');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('defaults to a 90 second limit (and says so in seconds)', async () => {
    vi.useFakeTimers();
    try {
      useHuggingFace();
      fetchMock = neverAnswers();
      vi.stubGlobal('fetch', fetchMock);
      const pending = generate('p').catch((e) => e);
      await vi.advanceTimersByTimeAsync(89_000);
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(2_000);
      const error = await pending;
      expect(error.code).toBe('LLM_TIMEOUT');
      expect(error.message).toContain('within 90 seconds');
    } finally {
      vi.useRealTimers();
    }
  });

  it('also covers a server that sends headers and then stalls on the body', async () => {
    useHuggingFace({ HF_TIMEOUT_MS: '40' });
    fetchMock = vi.fn((_url, { signal }) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect((await generate('p').catch((e) => e)).code).toBe('LLM_TIMEOUT');
  });
});

describe('fallback provider', () => {
  const failingHuggingFace = () => fetchMock.mockResolvedValue(errorResponse(503, 'overloaded'));

  it('tries the fallback once when the primary fails, and returns its answer', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    failingHuggingFace();
    generateWithGemini.mockResolvedValue('gemini saved it');

    expect(await generate('p', guestQuestionsResponseSchema)).toBe('gemini saved it');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateWithGemini).toHaveBeenCalledTimes(1);
    expect(generateWithGemini).toHaveBeenCalledWith('p', guestQuestionsResponseSchema);
    expect(logs.lines.some((line) => line.event === 'llm_fallback' && line.msg.includes('huggingface failed'))).toBe(true);
  });

  it('works the other way round: Gemini primary, Hugging Face fallback', async () => {
    process.env.LLM_FALLBACK_PROVIDER = 'huggingface';
    process.env.HF_TOKEN = 'hf_test_token';
    generateWithGemini.mockRejectedValue(Object.assign(new Error('quota exceeded'), { status: 429 }));
    fetchMock.mockResolvedValue(chatResponse('{"from":"hf"}'));

    expect(await generate('p')).toBe('{"from":"hf"}');
    expect(generateWithGemini).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a rate limit', () => fetchMock.mockResolvedValue(errorResponse(429))],
    ['a timeout', () => { process.env.HF_TIMEOUT_MS = '30'; fetchMock = neverAnswers(); vi.stubGlobal('fetch', fetchMock); }],
    ['a network error', () => fetchMock.mockRejectedValue(new TypeError('fetch failed'))],
    ['rejected credentials', () => fetchMock.mockResolvedValue(errorResponse(401))],
    ['an empty answer', () => fetchMock.mockResolvedValue(chatResponse(''))],
  ])('falls back after %s', async (_name, arrange) => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    arrange();
    generateWithGemini.mockResolvedValue('gemini text');
    expect(await generate('p', guestQuestionsResponseSchema)).toBe('gemini text');
  });

  it('never loops: each provider is called once, then the failure is reported with both reasons', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    failingHuggingFace();
    generateWithGemini.mockRejectedValue(new Error('gemini is down too'));

    const error = await generate('p').catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateWithGemini).toHaveBeenCalledTimes(1);
    expect(error.message).toContain('HTTP 503');
    expect(error.message).toContain('fallback provider (gemini) also failed: gemini is down too');
    expect(error.code).toBe('LLM_PROVIDER_ERROR'); // the primary's code decides how the app reports it
  });

  it('does not use the fallback to hide a configuration mistake with the primary', async () => {
    process.env.LLM_PROVIDER = 'huggingface'; // no HF_TOKEN
    process.env.LLM_FALLBACK_PROVIDER = 'gemini';
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('HF_TOKEN');
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it('says which key is missing when the fallback itself is not configured', async () => {
    process.env.LLM_FALLBACK_PROVIDER = 'huggingface'; // primary Gemini fails; no HF_TOKEN
    generateWithGemini.mockRejectedValue(new Error('gemini failed'));
    const error = await generate('p').catch((e) => e);
    expect(error.message).toContain('gemini failed');
    expect(error.message).toContain('HF_TOKEN');
  });

  it('without a fallback, the primary\'s own error is returned untouched', async () => {
    useHuggingFace();
    failingHuggingFace();
    const error = await generate('p').catch((e) => e);
    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).not.toContain('fallback');
    expect(generateWithGemini).not.toHaveBeenCalled();
    expect(logs.lines.some((line) => line.event === 'llm_fallback')).toBe(false);
  });

  it('does not call the fallback when the primary succeeds', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    fetchMock.mockResolvedValue(chatResponse('ok'));
    await generate('p');
    expect(generateWithGemini).not.toHaveBeenCalled();
  });
});
