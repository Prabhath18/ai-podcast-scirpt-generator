// Shape of the Intro and Outro generator's output, which is also what gets
// stored on an outline as `intro_outro`:
//   { hooks: [{ style, text }], intro_script, outros: [string], teaser }
// Two validators share the rules: the strict one checks a fresh LLM
// response (exactly five hooks, one per style, three outros, speaker labels
// matching the host count); the lenient one checks what a client saved after
// the user edited fields inline, where a text box may legitimately be empty.

export const HOOK_STYLES = ['Question', 'Bold claim', 'Story', 'Statistic', 'Cold open'];
const OUTRO_COUNT = 3;
const MAX_TEXT = 4000;

function isText(value) {
  return typeof value === 'string' && value.length <= MAX_TEXT;
}

function isFilled(value) {
  return isText(value) && value.trim().length > 0;
}

function checkShape(data, errors) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push({ field: 'intro_outro', message: 'intro_outro must be an object.' });
    return false;
  }
  if (!Array.isArray(data.hooks)) errors.push({ field: 'hooks', message: 'hooks must be an array.' });
  if (!Array.isArray(data.outros)) errors.push({ field: 'outros', message: 'outros must be an array.' });
  if (!isText(data.intro_script)) errors.push({ field: 'intro_script', message: 'intro_script must be a string.' });
  if (!isText(data.teaser)) errors.push({ field: 'teaser', message: 'teaser must be a string.' });
  return errors.length === 0;
}

/** Lenient check for stored data (used when an outline is saved). */
export function validateIntroOutro(data) {
  const errors = [];
  if (!checkShape(data, errors)) return { valid: false, errors };

  if (data.hooks.length > HOOK_STYLES.length || data.hooks.some((h) => !h || !HOOK_STYLES.includes(h.style) || !isText(h.text))) {
    errors.push({ field: 'hooks', message: 'Each hook needs a known style and a text string.' });
  }
  if (data.outros.length > OUTRO_COUNT || data.outros.some((o) => !isText(o))) {
    errors.push({ field: 'outros', message: `outros must be at most ${OUTRO_COUNT} strings.` });
  }
  return { valid: errors.length === 0, errors };
}

// Solo scripts are one voice, so they must not carry speaker labels. Duo and
// group scripts must label turns "Host 1:", "Host 2:" (and "Host 3:" for a group).
function checkSpeakers(script, hostCount, errors) {
  const hasHost = (n) => new RegExp(`(^|\\n)\\s*Host ${n}:`).test(script);
  if (hostCount === 'solo') {
    if (/(^|\n)\s*Host \d:/.test(script)) {
      errors.push({ field: 'intro_script', message: 'A solo intro must be one voice with no "Host N:" labels.' });
    }
  } else if (hostCount === 'duo' || hostCount === 'group') {
    if (!hasHost(1) || !hasHost(2)) {
      errors.push({ field: 'intro_script', message: 'A duo or group intro must label turns "Host 1:" and "Host 2:".' });
    }
  }
}

/** Strict check for a fresh LLM response. */
export function validateGeneratedIntroOutro(data, hostCount) {
  const errors = [];
  if (!checkShape(data, errors)) return { valid: false, errors };

  const styles = data.hooks.map((h) => h?.style);
  const hasEveryStyle = HOOK_STYLES.every((style) => styles.includes(style));
  if (data.hooks.length !== HOOK_STYLES.length || !hasEveryStyle || data.hooks.some((h) => !isFilled(h?.text))) {
    errors.push({ field: 'hooks', message: `Provide exactly one non-empty hook for each style: ${HOOK_STYLES.join(', ')}.` });
  }
  if (data.outros.length !== OUTRO_COUNT || data.outros.some((o) => !isFilled(o))) {
    errors.push({ field: 'outros', message: `Provide exactly ${OUTRO_COUNT} non-empty outros.` });
  }
  if (!isFilled(data.intro_script)) errors.push({ field: 'intro_script', message: 'intro_script is required.' });
  else checkSpeakers(data.intro_script, hostCount, errors);
  if (!isFilled(data.teaser)) errors.push({ field: 'teaser', message: 'teaser is required.' });

  return { valid: errors.length === 0, errors };
}
