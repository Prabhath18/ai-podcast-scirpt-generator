// The ONLY entry point for LLM calls: generate(prompt, schema). Every other module reaches a
// model through services/llmHelper.js, which layers JSON extraction, validation and a single
// retry on top of this function. Each provider lives in its own file under services/llm/
// (the only places that touch a provider SDK or API); this file just picks one.
//
//   LLM_PROVIDER            "gemini" (default) or "huggingface"
//   LLM_FALLBACK_PROVIDER   optional; the other one. Tried once if the primary call fails.
import { generateWithGemini, GEMINI_MODEL as GEMINI_MODEL_NAME } from './llm/gemini.js';
import { generateWithHuggingFace, DEFAULT_HF_MODEL } from './llm/huggingface.js';

// Kept: tests and docs refer to it by this name.
export const GEMINI_MODEL = GEMINI_MODEL_NAME;

const PROVIDERS = {
  gemini: generateWithGemini,
  huggingface: generateWithHuggingFace,
};
export const PROVIDER_NAMES = Object.keys(PROVIDERS);

/** The environment variables a provider cannot work without. */
const REQUIRED_ENV = { gemini: ['GEMINI_API_KEY'], huggingface: ['HF_TOKEN'] };

function configError(message) {
  const error = new Error(message);
  error.code = 'LLM_NOT_CONFIGURED';
  return error;
}

function readProviderName(variable, raw) {
  const name = raw.trim().toLowerCase();
  if (!PROVIDERS[name]) {
    throw configError(`${variable} is "${raw.trim()}", which is not a supported provider. Valid options: ${PROVIDER_NAMES.join(', ')}.`);
  }
  return name;
}

/** Which provider is primary and which (if any) is the fallback. Throws LLM_NOT_CONFIGURED for a bad setup. */
export function resolveProviders(env = process.env) {
  const primary = env.LLM_PROVIDER?.trim() ? readProviderName('LLM_PROVIDER', env.LLM_PROVIDER) : 'gemini';
  const fallback = env.LLM_FALLBACK_PROVIDER?.trim() ? readProviderName('LLM_FALLBACK_PROVIDER', env.LLM_FALLBACK_PROVIDER) : null;
  if (fallback === primary) {
    throw configError(`LLM_FALLBACK_PROVIDER must be different from LLM_PROVIDER (both are "${primary}"). Valid options: ${PROVIDER_NAMES.join(', ')}.`);
  }
  return { primary, fallback };
}

/**
 * What the server will use, and what is wrong with it. Never throws: it is for the startup
 * log, where a missing key must be a warning (the demos work without one), not a crash.
 */
export function describeLlmConfig(env = process.env) {
  try {
    const { primary, fallback } = resolveProviders(env);
    const problems = [primary, fallback]
      .filter(Boolean)
      .flatMap((name) => REQUIRED_ENV[name].filter((variable) => !env[variable]?.trim()).map((variable) => `${variable} is not set (needed for the ${name} provider).`));
    const model = primary === 'huggingface' ? env.HF_MODEL?.trim() || DEFAULT_HF_MODEL : GEMINI_MODEL;
    return { primary, fallback, model, problems };
  } catch (err) {
    return { primary: null, fallback: null, model: null, problems: [err.message] };
  }
}

/** Both providers failed: report the primary's failure (its code decides retry and status), plus the fallback's reason. */
function bothFailed(primaryError, fallbackName, fallbackError) {
  const error = new Error(`${primaryError.message} The fallback provider (${fallbackName}) also failed: ${fallbackError.message}`);
  error.code = primaryError.code;
  return error;
}

/**
 * Sends one prompt to the configured provider and returns the model's raw text.
 * If a fallback provider is configured and the primary call fails for any reason other than
 * a configuration mistake, the fallback is tried once. Configuration mistakes are never
 * papered over by the fallback: they should be loud.
 *
 * @param {string} prompt Full prompt text.
 * @param {object} [responseSchema] The app's response schema (Gemini dialect). Gemini enforces it;
 *   other providers get it as text in the prompt. Omit for free text.
 * @returns {Promise<string>}
 */
export async function generate(prompt, responseSchema) {
  const { primary, fallback } = resolveProviders();

  try {
    return await PROVIDERS[primary](prompt, responseSchema);
  } catch (primaryError) {
    if (!fallback || primaryError.code === 'LLM_NOT_CONFIGURED') throw primaryError;

    // eslint-disable-next-line no-console -- intentional server-side notice
    console.warn(`[llm] ${primary} failed (${primaryError.code || 'error'}: ${primaryError.message}); trying ${fallback} once.`);
    try {
      return await PROVIDERS[fallback](prompt, responseSchema);
    } catch (fallbackError) {
      throw bothFailed(primaryError, fallback, fallbackError);
    }
  }
}
