import { describe, it, expect, vi, beforeEach } from 'vitest';

// llmHelper.js is tested on its own here, with the provider layer (generate) replaced, to pin
// down which failures are retried and which are reported straight away.
vi.mock('../services/llm.js', () => ({ generate: vi.fn(), GEMINI_MODEL: 'test-model' }));
import { generate } from '../services/llm.js';
import { callStructuredLLM } from '../services/llmHelper.js';

const codeError = (code, message = `${code} happened`) => Object.assign(new Error(message), { code });
const valid = (data) => ({ valid: Array.isArray(data?.items), errors: [{ field: 'items', message: 'items must be an array' }] });

beforeEach(() => {
  generate.mockReset(); // (not an arrow returning the mock: Vitest would call a returned function as cleanup)
});

describe('what is retried, and what is not', () => {
  it.each(['LLM_TIMEOUT', 'LLM_RATE_LIMITED', 'LLM_AUTH', 'LLM_NOT_CONFIGURED'])('%s is reported at once, unchanged, with no retry', async (code) => {
    generate.mockRejectedValue(codeError(code));
    const error = await callStructuredLLM('p', {}, valid).catch((e) => e);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain('after one retry');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('LLM_PROVIDER_ERROR is retried once, then reported with its own code', async () => {
    generate.mockRejectedValue(codeError('LLM_PROVIDER_ERROR', 'Hugging Face returned HTTP 503.'));
    const error = await callStructuredLLM('p', {}, valid).catch((e) => e);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(error.code).toBe('LLM_PROVIDER_ERROR');
    expect(error.message).toBe('Hugging Face returned HTTP 503. (after one retry)');
  });

  it('a provider hiccup followed by a good answer succeeds', async () => {
    generate.mockRejectedValueOnce(codeError('LLM_PROVIDER_ERROR')).mockResolvedValueOnce('{"items":[1]}');
    expect(await callStructuredLLM('p', {}, valid)).toEqual({ items: [1] });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('an error with no code (e.g. from the Gemini SDK) is retried once, then LLM_INVALID_RESPONSE, as before', async () => {
    generate.mockRejectedValue(Object.assign(new Error('models/x not found'), { status: 404 }));
    const error = await callStructuredLLM('p', {}, valid).catch((e) => e);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(error.code).toBe('LLM_INVALID_RESPONSE');
    expect(error.message).toBe('models/x not found (after one retry)');
  });

  it('LLM_EMPTY_RESPONSE is retried once, then LLM_INVALID_RESPONSE, as before', async () => {
    generate.mockRejectedValue(codeError('LLM_EMPTY_RESPONSE', 'Gemini returned an empty response.'));
    const error = await callStructuredLLM('p', {}, valid).catch((e) => e);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(error.code).toBe('LLM_INVALID_RESPONSE');
  });

  it('a provider error on the first try and bad JSON on the second ends as LLM_INVALID_RESPONSE (the last failure decides)', async () => {
    generate.mockRejectedValueOnce(codeError('LLM_PROVIDER_ERROR')).mockResolvedValueOnce('not json');
    const error = await callStructuredLLM('p', {}, valid).catch((e) => e);
    expect(error.code).toBe('LLM_INVALID_RESPONSE');
    expect(error.message).toContain('not valid JSON');
  });

  it('bad JSON on the first try and a provider error on the second ends with the provider\'s code', async () => {
    generate.mockResolvedValueOnce('not json').mockRejectedValueOnce(codeError('LLM_PROVIDER_ERROR', 'HTTP 503'));
    const error = await callStructuredLLM('p', {}, valid).catch((e) => e);
    expect(error.code).toBe('LLM_PROVIDER_ERROR');
  });
});

describe('reading JSON out of what the model wrote', () => {
  it.each([
    ['bare JSON', '{"items":[1,2]}'],
    ['a fenced block', '```json\n{"items":[1,2]}\n```'],
    ['prose around it', 'Certainly! {"items":[1,2]} Anything else?'],
    ['a fence inside prose', 'Here:\n```\n{"items":[1,2]}\n```\nDone.'],
    ['a think block', '<think>hmm {"items": []}</think>{"items":[1,2]}'],
  ])('parses %s', async (_name, text) => {
    generate.mockResolvedValue(text);
    expect(await callStructuredLLM('p', {}, valid)).toEqual({ items: [1, 2] });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('retries with the validation errors when the JSON is well-formed but wrong', async () => {
    generate.mockResolvedValueOnce('```json\n{"nope":1}\n```').mockResolvedValueOnce('{"items":[]}');
    await callStructuredLLM('base prompt', {}, valid);
    expect(generate.mock.calls[1][0]).toContain('base prompt');
    expect(generate.mock.calls[1][0]).toContain('items must be an array');
  });

  it('still returns a validator\'s cleaned value and salvages a partial result', async () => {
    generate.mockResolvedValue('text {"items":[1]} text');
    expect(await callStructuredLLM('p', {}, () => ({ valid: true, errors: [], value: { cleaned: true } }))).toEqual({ cleaned: true });

    generate.mockReset();
    generate.mockResolvedValue('{"items":"bad"}');
    const salvage = { items: ['kept'] };
    expect(await callStructuredLLM('p', {}, () => ({ valid: false, errors: [{ field: 'x', message: 'y' }], salvage }))).toBe(salvage);
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
