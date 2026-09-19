import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guestQuestionsResponseSchema } from '../prompts/schemas.js';

// The real Gemini wrapper (services/llm/gemini.js) with the SDK replaced by a fake whose
// generateContentStream yields chunks like the real one does. Nothing here touches the network.
const sdk = vi.hoisted(() => ({ generateContent: vi.fn(), generateContentStream: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      this.models = { generateContent: sdk.generateContent, generateContentStream: sdk.generateContentStream };
    }
  },
}));

import { GEMINI_MODEL, streamWithGemini } from '../services/llm/gemini.js';

/** What generateContentStream returns: an async iterable of chunks with a `text` getter. */
const chunksOf = (...texts) =>
  (async function* stream() {
    for (const text of texts) yield { text };
  })();

let savedKey;
beforeEach(() => {
  savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  sdk.generateContent.mockReset();
  sdk.generateContentStream.mockReset();
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
});

describe('Gemini streaming', () => {
  it('hands over each chunk of text as it arrives and returns the whole text', async () => {
    sdk.generateContentStream.mockResolvedValue(chunksOf('{"episode_', 'title":"A"', '}'));
    const seen = [];

    const text = await streamWithGemini('prompt', guestQuestionsResponseSchema, (delta) => seen.push(delta));

    expect(text).toBe('{"episode_title":"A"}');
    expect(seen).toEqual(['{"episode_', 'title":"A"', '}']);
  });

  it('puts the model in JSON mode with the response schema, exactly like the plain call', async () => {
    sdk.generateContentStream.mockResolvedValue(chunksOf('{}'));

    await streamWithGemini('the prompt', guestQuestionsResponseSchema, () => {});

    expect(sdk.generateContentStream).toHaveBeenCalledWith({
      model: GEMINI_MODEL,
      contents: 'the prompt',
      config: { responseMimeType: 'application/json', responseSchema: guestQuestionsResponseSchema },
    });
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });

  it('sends no config for free text, and passes the abort signal through when there is one', async () => {
    sdk.generateContentStream.mockResolvedValue(chunksOf('hi'));
    await streamWithGemini('p', undefined, () => {});
    expect(sdk.generateContentStream.mock.calls[0][0]).toEqual({ model: GEMINI_MODEL, contents: 'p' });

    sdk.generateContentStream.mockResolvedValue(chunksOf('{}'));
    const controller = new AbortController();
    await streamWithGemini('p', guestQuestionsResponseSchema, () => {}, { signal: controller.signal });
    expect(sdk.generateContentStream.mock.calls[1][0].config).toEqual({
      responseMimeType: 'application/json',
      responseSchema: guestQuestionsResponseSchema,
      abortSignal: controller.signal,
    });
  });

  it('ignores chunks that carry no text (safety metadata, usage-only chunks)', async () => {
    sdk.generateContentStream.mockResolvedValue(chunksOf(undefined, '', 'real', undefined));
    const seen = [];

    expect(await streamWithGemini('p', undefined, (delta) => seen.push(delta))).toBe('real');
    expect(seen).toEqual(['real']);
  });

  it('reports a stream with no text as LLM_EMPTY_RESPONSE, like the plain call', async () => {
    sdk.generateContentStream.mockResolvedValue(chunksOf('  ', undefined));

    const error = await streamWithGemini('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe('LLM_EMPTY_RESPONSE');
    expect(error.message).toBe('Gemini returned an empty response.');
  });

  it('needs GEMINI_API_KEY, and does not call the SDK without it', async () => {
    // The client is cached once created, so load a fresh copy of the module that has never seen a key.
    vi.resetModules();
    delete process.env.GEMINI_API_KEY;
    const { streamWithGemini: withoutKey } = await import('../services/llm/gemini.js');

    const error = await withoutKey('p', undefined, () => {}).catch((e) => e);

    expect(error.code).toBe('LLM_NOT_CONFIGURED');
    expect(error.message).toBe('GEMINI_API_KEY is not configured on the server.');
    expect(sdk.generateContentStream).not.toHaveBeenCalled();
  });

  it('lets an SDK error through unchanged, as the plain call does (llmHelper treats a code-less error as retryable)', async () => {
    const failure = Object.assign(new Error('models/x is not found'), { status: 404 });
    sdk.generateContentStream.mockRejectedValue(failure);

    const error = await streamWithGemini('p', undefined, () => {}).catch((e) => e);

    expect(error).toBe(failure);
    expect(error.code).toBeUndefined();
  });

  it('lets an error thrown midway through the stream through unchanged', async () => {
    sdk.generateContentStream.mockResolvedValue(
      (async function* broken() {
        yield { text: '{"a"' };
        throw new Error('stream reset');
      })(),
    );

    const error = await streamWithGemini('p', undefined, () => {}).catch((e) => e);

    expect(error.message).toBe('stream reset');
  });
});
