import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HF_DONE, bodyOfCall, errorResponse, hfDelta, isolateLlmEnv, streamingFetch } from './llmTestUtils.js';
import { guestQuestionsResponseSchema } from '../prompts/schemas.js';
import { captureLogs } from '../utils/logger.js';

// Streaming through the provider router (services/llm.js): the Gemini wrapper is replaced, the router and the
// Hugging Face adapter are real, and Hugging Face's HTTP endpoint is a fetch mock streaming SSE. No network.
vi.mock('../services/llm/gemini.js', () => ({
  generateWithGemini: vi.fn(),
  streamWithGemini: vi.fn(),
  GEMINI_MODEL: 'test-gemini-model',
}));

import { generateWithGemini, streamWithGemini } from '../services/llm/gemini.js';
import { generate, generateStream } from '../services/llm.js';
import { streamWithHuggingFace } from '../services/llm/huggingface.js';

let restoreEnv;
let logs;

beforeEach(() => {
  restoreEnv = isolateLlmEnv();
  generateWithGemini.mockReset();
  streamWithGemini.mockReset();
  logs = captureLogs('debug');
});
afterEach(() => {
  logs.restore();
  restoreEnv();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const useHuggingFace = (extra = {}) => Object.assign(process.env, { LLM_PROVIDER: 'huggingface', HF_TOKEN: 'hf_test_token', ...extra });
const collect = () => {
  const chunks = [];
  return { chunks, onChunk: (delta) => chunks.push(delta) };
};

describe('Hugging Face streaming', () => {
  it('sends stream: true with JSON mode, and hands over each piece of text as it arrives', async () => {
    useHuggingFace();
    const fetchMock = streamingFetch([hfDelta('{"a":'), hfDelta('1'), hfDelta('}'), HF_DONE]);
    vi.stubGlobal('fetch', fetchMock);
    const { chunks, onChunk } = collect();

    const text = await streamWithHuggingFace('the prompt', guestQuestionsResponseSchema, onChunk);

    expect(text).toBe('{"a":1}');
    expect(chunks).toEqual(['{"a":', '1', '}']);
    const body = bodyOfCall(fetchMock);
    expect(body).toMatchObject({ stream: true, model: expect.any(String), response_format: { type: 'json_object' } });
    expect(body.messages[1].content).toContain('the prompt');
    expect(body.messages[1].content).toContain('JSON Schema'); // the schema is in the prompt, as for the plain call
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer hf_test_token', Accept: 'text/event-stream' });
  });

  it('reassembles events that arrive split across network chunks, with CRLF line ends and keep-alive comments', async () => {
    useHuggingFace();
    const frame = hfDelta('hello');
    vi.stubGlobal(
      'fetch',
      streamingFetch([
        ': keep-alive\n\n',
        frame.slice(0, 12), // half a line
        frame.slice(12, 30),
        `${frame.slice(30)}`,
        hfDelta(' wor').replace(/\n/g, '\r\n'),
        hfDelta('ld'),
        HF_DONE,
      ]),
    );
    const { chunks, onChunk } = collect();

    expect(await streamWithHuggingFace('p', undefined, onChunk)).toBe('hello world');
    expect(chunks).toEqual(['hello', ' wor', 'ld']);
  });

  it('accepts a final event with no trailing blank line, and text parts in an array', async () => {
    useHuggingFace();
    const parts = `data: ${JSON.stringify({ choices: [{ delta: { content: [{ text: 'a' }, { text: 'b' }] } }] })}\n\n`;
    vi.stubGlobal('fetch', streamingFetch([parts, hfDelta('c').trimEnd()]));

    expect(await streamWithHuggingFace('p', undefined, () => {})).toBe('abc');
  });

  it('skips a malformed chunk instead of failing the whole answer', async () => {
    useHuggingFace();
    vi.stubGlobal('fetch', streamingFetch([hfDelta('ok'), 'data: {not json\n\n', hfDelta('!'), HF_DONE]));

    expect(await streamWithHuggingFace('p', undefined, () => {})).toBe('ok!');
  });

  it('leaves out response_format for free text, and asks again without it when the provider refuses JSON mode', async () => {
    useHuggingFace();
    const plain = streamingFetch([hfDelta('text'), HF_DONE]);
    vi.stubGlobal('fetch', plain);
    await streamWithHuggingFace('p', undefined, () => {});
    expect(bodyOfCall(plain).response_format).toBeUndefined();

    const refusing = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(400, 'response_format is not supported'))
      .mockImplementationOnce(streamingFetch([hfDelta('{"ok":true}'), HF_DONE]));
    vi.stubGlobal('fetch', refusing);

    expect(await streamWithHuggingFace('p', guestQuestionsResponseSchema, () => {})).toBe('{"ok":true}');
    expect(refusing).toHaveBeenCalledTimes(2);
    expect(bodyOfCall(refusing, 0).response_format).toBeDefined();
    expect(bodyOfCall(refusing, 1).response_format).toBeUndefined();
    expect(bodyOfCall(refusing, 1).stream).toBe(true);
  });

  it.each([
    [401, 'LLM_AUTH', 'HF_TOKEN'],
    [403, 'LLM_AUTH', 'HF_TOKEN'],
    [402, 'LLM_RATE_LIMITED', 'credits'],
    [429, 'LLM_RATE_LIMITED', 'rate limit'],
    [404, 'LLM_PROVIDER_ERROR', 'HF_MODEL'],
    [503, 'LLM_PROVIDER_ERROR', 'HTTP 503'],
  ])('maps HTTP %i to %s with the same wording as the plain call', async (status, code, phrase) => {
    useHuggingFace();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(status, 'nope')));

    const error = await streamWithHuggingFace('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe(code);
    expect(error.message).toContain(phrase);
  });

  it('needs HF_TOKEN, and does not touch the network without it', async () => {
    process.env.LLM_PROVIDER = 'huggingface';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const error = await streamWithHuggingFace('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('HF_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an empty stream as LLM_EMPTY_RESPONSE', async () => {
    useHuggingFace();
    vi.stubGlobal('fetch', streamingFetch([HF_DONE]));
    expect((await streamWithHuggingFace('p', undefined, () => {}).catch((e) => e)).code).toBe('LLM_EMPTY_RESPONSE');
  });

  it('reports an error sent inside the stream as LLM_PROVIDER_ERROR', async () => {
    useHuggingFace();
    vi.stubGlobal('fetch', streamingFetch([hfDelta('{"a"'), `data: ${JSON.stringify({ error: { message: 'model crashed' } })}\n\n`]));

    const error = await streamWithHuggingFace('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).toContain('model crashed');
  });

  it('reports a connection that breaks mid-stream as LLM_PROVIDER_ERROR', async () => {
    useHuggingFace();
    vi.stubGlobal('fetch', streamingFetch([hfDelta('{"a"'), new Error('socket hang up')]));

    const error = await streamWithHuggingFace('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).toMatch(/Lost the connection.*socket hang up/);
  });

  it('times out on silence, as LLM_TIMEOUT, and says the model may be cold-starting', async () => {
    useHuggingFace({ HF_TIMEOUT_MS: '60' });
    vi.stubGlobal('fetch', streamingFetch([hfDelta('{"a"')], { stall: true })); // one chunk, then nothing

    const error = await streamWithHuggingFace('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe('LLM_TIMEOUT');
    expect(error.message).toContain('sent nothing');
    expect(error.message).toContain('HF_TIMEOUT_MS');
  });

  it('treats HF_TIMEOUT_MS as an idle timeout: a long answer that keeps flowing is not cut off', async () => {
    useHuggingFace({ HF_TIMEOUT_MS: '80' });
    // Twelve pieces 30 ms apart take ~360 ms in total, well over the 80 ms limit, but no gap exceeds it.
    const pieces = Array.from({ length: 12 }, (_, i) => [30, hfDelta(String(i % 10))]).flat();
    vi.stubGlobal('fetch', streamingFetch([...pieces, HF_DONE]));

    expect(await streamWithHuggingFace('p', undefined, () => {})).toHaveLength(12);
  });

  it('stops when the caller aborts, as LLM_ABORTED, and aborts the request', async () => {
    useHuggingFace();
    const fetchMock = streamingFetch([hfDelta('{"a"')], { stall: true });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const pending = streamWithHuggingFace('p', undefined, () => controller.abort(), { signal: controller.signal }).catch((e) => e);
    const error = await pending;

    expect(error.code).toBe('LLM_ABORTED');
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('does not even send the request if the caller has already gone', async () => {
    useHuggingFace();
    const fetchMock = streamingFetch([hfDelta('x')]);
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();

    const error = await streamWithHuggingFace('p', undefined, () => {}, { signal: controller.signal }).catch((e) => e);

    expect(error.code).toBe('LLM_ABORTED');
  });
});

describe('generateStream: provider selection', () => {
  it('uses Gemini by default and passes the prompt, schema, chunk callback and signal through', async () => {
    streamWithGemini.mockImplementation(async (_prompt, _schema, onChunk) => {
      onChunk('{"q"');
      onChunk(':[]}');
      return '{"q":[]}';
    });
    const { chunks, onChunk } = collect();
    const controller = new AbortController();

    const text = await generateStream('prompt', guestQuestionsResponseSchema, onChunk, { signal: controller.signal });

    expect(text).toBe('{"q":[]}');
    expect(chunks).toEqual(['{"q"', ':[]}']);
    expect(streamWithGemini).toHaveBeenCalledWith('prompt', guestQuestionsResponseSchema, onChunk, { signal: controller.signal });
    expect(generateWithGemini).not.toHaveBeenCalled(); // streaming does not use the plain call
  });

  it('uses Hugging Face when LLM_PROVIDER says so', async () => {
    useHuggingFace();
    vi.stubGlobal('fetch', streamingFetch([hfDelta('hi'), HF_DONE]));

    expect(await generateStream('p', undefined, () => {})).toBe('hi');
    expect(streamWithGemini).not.toHaveBeenCalled();
  });

  it('leaves the plain generate() exactly as it was (it never streams)', async () => {
    generateWithGemini.mockResolvedValue('plain text');

    expect(await generate('p', guestQuestionsResponseSchema)).toBe('plain text');
    expect(streamWithGemini).not.toHaveBeenCalled();
  });

  it('reports an unknown LLM_PROVIDER the same way as generate()', async () => {
    process.env.LLM_PROVIDER = 'openai';
    const error = await generateStream('p', undefined, () => {}).catch((e) => e);
    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toContain('Valid options: gemini, huggingface');
  });
});

describe('generateStream: fallback', () => {
  it('tries the fallback once when the primary fails, telling the caller the text starts over', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    // (the 10 ms pause lets the first chunk be read before the connection breaks)
    vi.stubGlobal('fetch', streamingFetch([hfDelta('{"partial"'), 10, new Error('socket hang up')]));
    streamWithGemini.mockImplementation(async (_p, _s, onChunk) => {
      onChunk('{"whole":true}');
      return '{"whole":true}';
    });
    const events = [];

    const text = await generateStream('p', undefined, (delta) => events.push(`chunk:${delta}`), { onRestart: (info) => events.push(`restart:${info.reason}:${info.provider}`) });

    expect(text).toBe('{"whole":true}');
    expect(events).toEqual(['chunk:{"partial"', 'restart:fallback:gemini', 'chunk:{"whole":true}']);
    expect(logs.lines.some((line) => line.event === 'llm_fallback' && line.from === 'huggingface')).toBe(true);
  });

  it.each([
    ['a missing key', 'LLM_NOT_CONFIGURED'],
    ['a cancelled request', 'LLM_ABORTED'],
  ])('does not paper over %s with the fallback', async (_what, code) => {
    process.env.LLM_FALLBACK_PROVIDER = 'huggingface';
    process.env.HF_TOKEN = 'hf_test_token';
    streamWithGemini.mockRejectedValue(Object.assign(new Error('nope'), { code }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const error = await generateStream('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe(code);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not use the fallback once the caller has aborted, whatever the error was', async () => {
    process.env.LLM_FALLBACK_PROVIDER = 'huggingface';
    process.env.HF_TOKEN = 'hf_test_token';
    const controller = new AbortController();
    streamWithGemini.mockImplementation(async () => {
      controller.abort();
      throw new Error('socket closed');
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await generateStream('p', undefined, () => {}, { signal: controller.signal }).catch(() => {});

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports both failures with the primary\'s code when neither works', async () => {
    useHuggingFace({ LLM_FALLBACK_PROVIDER: 'gemini' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(503, 'overloaded')));
    streamWithGemini.mockRejectedValue(new Error('Gemini quota'));

    const error = await generateStream('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).toContain('The fallback provider (gemini) also failed: Gemini quota');
  });
});

describe('generateStream: logging', () => {
  it('logs the call with streaming: true, the provider, the model and the outcome', async () => {
    streamWithGemini.mockResolvedValue('abc');

    await generateStream('p', undefined, () => {});

    const call = logs.lines.find((line) => line.event === 'llm_call');
    expect(call).toMatchObject({ provider: 'gemini', model: 'test-gemini-model', streaming: true, outcome: 'ok', chars: 3 });
    expect(typeof call.durationMs).toBe('number');
  });

  it('logs a failed streaming call with its code', async () => {
    streamWithGemini.mockRejectedValue(Object.assign(new Error('slow'), { code: 'LLM_TIMEOUT' }));

    await generateStream('p', undefined, () => {}).catch(() => {});

    expect(logs.lines.find((line) => line.event === 'llm_call')).toMatchObject({ streaming: true, outcome: 'error', code: 'LLM_TIMEOUT' });
  });
});
