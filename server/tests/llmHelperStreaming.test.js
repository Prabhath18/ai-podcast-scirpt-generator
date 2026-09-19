import { describe, it, expect, vi, beforeEach } from 'vitest';

// llmHelper.js on its own, with the provider layer replaced: streaming must change how progress is reported and
// nothing else. The parse, validate and retry-once rules are the ones llmHelper.test.js pins down for generate().
vi.mock('../services/llm.js', () => ({ generate: vi.fn(), generateStream: vi.fn(), GEMINI_MODEL: 'test-model' }));
import { generate, generateStream } from '../services/llm.js';
import { callStructuredLLM } from '../services/llmHelper.js';

const codeError = (code, message = `${code} happened`) => Object.assign(new Error(message), { code });
const valid = (data) => ({ valid: Array.isArray(data?.items), errors: [{ field: 'items', message: 'items must be an array' }] });

beforeEach(() => {
  generate.mockReset();
  generateStream.mockReset();
});

/** A generateStream that writes `text` in three pieces, like a model would. */
const writes = (text) => async (_prompt, _schema, onChunk) => {
  const third = Math.ceil(text.length / 3);
  for (let i = 0; i < text.length; i += third) onChunk(text.slice(i, i + third));
  return text;
};

describe('callStructuredLLM with a stream', () => {
  it('streams the attempt, reports the chunks, and returns the same parsed, validated result', async () => {
    generateStream.mockImplementation(writes('{"items":[1,2]}'));
    const chunks = [];

    const result = await callStructuredLLM('p', { shape: true }, valid, { onChunk: (delta) => chunks.push(delta) });

    expect(result).toEqual({ items: [1, 2] });
    expect(chunks.join('')).toBe('{"items":[1,2]}');
    expect(chunks.length).toBeGreaterThan(1);
    expect(generateStream).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(generateStream.mock.calls[0][0]).toBe('p');
    expect(generateStream.mock.calls[0][1]).toEqual({ shape: true });
  });

  it('without onChunk it is the plain call, byte for byte as before', async () => {
    generate.mockResolvedValue('{"items":[]}');

    expect(await callStructuredLLM('p', {}, valid)).toEqual({ items: [] });
    expect(generate).toHaveBeenCalledWith('p', {});
    expect(generateStream).not.toHaveBeenCalled();
  });

  it.each([
    ['a fenced block', '```json\n{"items":[1]}\n```'],
    ['prose around it', 'Here you go: {"items":[1]} Enjoy!'],
    ['a think block', '<think>hmm</think>{"items":[1]}'],
  ])('finds the JSON in %s exactly as the plain path does', async (_name, text) => {
    generateStream.mockImplementation(writes(text));
    expect(await callStructuredLLM('p', {}, valid, { onChunk: () => {} })).toEqual({ items: [1] });
  });

  it('retries once when the answer fails validation: says the text starts over, then streams the corrected attempt', async () => {
    generateStream.mockImplementationOnce(writes('{"nope":1}')).mockImplementationOnce(writes('{"items":[7]}'));
    const events = [];

    const result = await callStructuredLLM('base prompt', {}, valid, {
      onChunk: (delta) => events.push(`chunk:${delta.length}`),
      onRestart: (info) => events.push(`restart:${info.reason}`),
    });

    expect(result).toEqual({ items: [7] });
    expect(generateStream).toHaveBeenCalledTimes(2);
    expect(generateStream.mock.calls[1][0]).toContain('base prompt');
    expect(generateStream.mock.calls[1][0]).toContain('items must be an array'); // the same feedback the plain retry gives
    expect(events.filter((e) => e.startsWith('restart'))).toEqual(['restart:retry']);
    expect(events.indexOf('restart:retry')).toBeGreaterThan(0); // after the first attempt's chunks
    expect(events.at(-1)).toMatch(/^chunk/); // and before the second's
  });

  it('gives up after one retry, with the same error as the plain path (LLM_INVALID_RESPONSE)', async () => {
    generateStream.mockImplementation(writes('not json at all'));

    const error = await callStructuredLLM('p', {}, valid, { onChunk: () => {} }).catch((e) => e);

    expect(generateStream).toHaveBeenCalledTimes(2);
    expect(error.code).toBe('LLM_INVALID_RESPONSE');
    expect(error.message).toContain('not valid JSON');
    expect(error.message).toContain('(after one retry)');
  });

  it('still salvages a partial result when the retry also fails', async () => {
    generateStream.mockImplementation(writes('{"items":"bad"}'));
    const salvage = { items: ['kept'] };

    const result = await callStructuredLLM('p', {}, () => ({ valid: false, errors: [{ field: 'x', message: 'y' }], salvage }), { onChunk: () => {} });

    expect(result).toBe(salvage);
  });

  it.each(['LLM_TIMEOUT', 'LLM_RATE_LIMITED', 'LLM_AUTH', 'LLM_NOT_CONFIGURED'])('%s is reported at once with no retry, streaming or not', async (code) => {
    generateStream.mockRejectedValue(codeError(code));

    const error = await callStructuredLLM('p', {}, valid, { onChunk: () => {} }).catch((e) => e);

    expect(error.code).toBe(code);
    expect(generateStream).toHaveBeenCalledTimes(1);
  });

  it('retries a provider error once (a dropped stream, say) and keeps its code if it happens again', async () => {
    generateStream.mockRejectedValue(codeError('LLM_PROVIDER_ERROR', 'Lost the connection'));

    const error = await callStructuredLLM('p', {}, valid, { onChunk: () => {} }).catch((e) => e);

    expect(generateStream).toHaveBeenCalledTimes(2);
    expect(error.code).toBe('LLM_PROVIDER_ERROR');
  });

  it('passes the abort signal down, and forwards the fallback restart notice to the caller', async () => {
    const controller = new AbortController();
    generateStream.mockImplementation(async (_p, _s, _onChunk, options) => {
      options.onRestart({ reason: 'fallback', provider: 'gemini' });
      return '{"items":[]}';
    });
    const restarts = [];

    await callStructuredLLM('p', {}, valid, { onChunk: () => {}, signal: controller.signal, onRestart: (info) => restarts.push(info) });

    expect(generateStream.mock.calls[0][3].signal).toBe(controller.signal);
    expect(restarts).toEqual([{ reason: 'fallback', provider: 'gemini' }]);
  });

  it('does not retry once the caller has gone away (LLM_ABORTED, or any error after an abort)', async () => {
    generateStream.mockRejectedValue(codeError('LLM_ABORTED', 'The request was cancelled.'));
    const aborted = await callStructuredLLM('p', {}, valid, { onChunk: () => {} }).catch((e) => e);
    expect(aborted.code).toBe('LLM_ABORTED');
    expect(generateStream).toHaveBeenCalledTimes(1);

    generateStream.mockReset();
    const controller = new AbortController();
    generateStream.mockImplementation(async () => {
      controller.abort();
      throw new Error('socket closed');
    });
    await callStructuredLLM('p', {}, valid, { onChunk: () => {}, signal: controller.signal }).catch(() => {});
    expect(generateStream).toHaveBeenCalledTimes(1);
  });
});
