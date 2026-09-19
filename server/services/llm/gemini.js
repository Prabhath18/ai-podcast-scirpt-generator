// The Gemini provider. Unchanged behavior: this is the code that used to live directly in
// services/llm.js, moved here so each provider sits in its own small file. Gemini enforces
// the response schema itself (JSON mode), so the prompt is sent as written.
import { GoogleGenAI } from '@google/genai';

// Set GEMINI_MODEL to override without a code change if Google renames or retires the model.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

let cachedClient = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is not configured on the server.');
    error.code = 'LLM_NOT_CONFIGURED';
    throw error;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

/**
 * Calls Gemini once and returns the raw text of the response.
 *
 * @param {string} prompt Full prompt text.
 * @param {object} [responseSchema] Gemini structured-output schema. When
 *   provided, the model is put into JSON mode (`responseMimeType:
 *   "application/json"`) and asked to conform to this shape. Omit for
 *   free-text responses.
 * @returns {Promise<string>}
 */
export async function generateWithGemini(prompt, responseSchema) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    ...(responseSchema
      ? { config: { responseMimeType: 'application/json', responseSchema } }
      : {}),
  });

  const text = response?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    const error = new Error('Gemini returned an empty response.');
    error.code = 'LLM_EMPTY_RESPONSE';
    throw error;
  }
  return text;
}

/**
 * The same call, streamed: `onChunk(delta)` runs for each piece of text as Gemini produces it,
 * and the full text is returned at the end, exactly what generateWithGemini would have returned.
 * Aborting `signal` (the client went away) stops the request.
 *
 * @param {string} prompt
 * @param {object} [responseSchema]
 * @param {(delta: string) => void} onChunk
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<string>}
 */
export async function streamWithGemini(prompt, responseSchema, onChunk, { signal } = {}) {
  const ai = getClient();

  const config = {
    ...(responseSchema ? { responseMimeType: 'application/json', responseSchema } : {}),
    ...(signal ? { abortSignal: signal } : {}),
  };
  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: prompt,
    ...(Object.keys(config).length ? { config } : {}),
  });

  let text = '';
  for await (const chunk of stream) {
    const delta = chunk?.text;
    if (typeof delta === 'string' && delta.length > 0) {
      text += delta;
      onChunk(delta);
    }
  }

  if (text.trim().length === 0) {
    const error = new Error('Gemini returned an empty response.');
    error.code = 'LLM_EMPTY_RESPONSE';
    throw error;
  }
  return text;
}
