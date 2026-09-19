// The ONLY module in this codebase allowed to import the Gemini SDK. Every
// other module that needs an LLM response goes through services/llmHelper.js
// instead, which layers JSON parsing, schema validation, and retries on top
// of the single `generate()` function exported here. Centralizing the SDK
// call like this means swapping providers later touches one file.
import { GoogleGenAI } from '@google/genai';

// gemini-2.5-flash was retired for new users (the API returns 404 NOT_FOUND),
// so the default is gemini-3.6-flash. If Google renames or retires it again,
// set GEMINI_MODEL in the environment to override without a code change --
// see README "Known limitations" for how to pick a replacement.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

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
export async function generate(prompt, responseSchema) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
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

export const GEMINI_MODEL = MODEL;
