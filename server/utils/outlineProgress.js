// Turns the outline JSON as the model is still writing it into real progress: which part it has
// reached and how many segments are done. It only looks at text that has already arrived; it never
// waits for, repairs or replaces the final result (that goes through llmHelper.js as usual).
//
// It works on the raw text, which may not be valid JSON yet (cut off mid-string) or may be wrapped
// in a code fence or a sentence, so it counts complete keys and strings with regular expressions
// instead of parsing.

// A complete JSON string value: an opening quote, characters or escapes, a closing quote.
const STRING = String.raw`"(?:[^"\\]|\\.)*"`;
const keyWithString = (key) => new RegExp(String.raw`"${key}"\s*:\s*${STRING}`);

const SEGMENTS_KEY = /"segments"\s*:\s*\[/;
const TITLE_KEY = /"title"\s*:/g; // a segment's title; the episode's is "episode_title", which does not match
const TRANSITION = new RegExp(String.raw`"transition"\s*:\s*${STRING}`, 'g'); // the last field of a segment
const GUEST_QUESTIONS_KEY = /"guest_questions"\s*:/;
const OUTRO_KEY = /"outro"\s*:/;

/** The prompt asks for 5 to 8 segments, scaled to the episode length; this is only a guess for "N of about M". */
export function expectedSegmentCount(lengthMins) {
  const guess = Math.round(Number(lengthMins) / 6);
  return Math.min(8, Math.max(5, Number.isFinite(guess) ? guess : 6));
}

/**
 * @param {string} text everything the model has written so far
 * @param {{ lengthMins?: number }} [context]
 * @returns {{ stage: 'starting'|'title'|'intro'|'segments'|'questions'|'outro',
 *             fraction: number, segmentsDrafted: number, segmentsExpected: number, chars: number }}
 *   `fraction` is 0 to 0.95 (the last 5% is for the validated result, which arrives as its own event).
 */
export function describeOutlineProgress(text, { lengthMins } = {}) {
  const hasTitle = keyWithString('episode_title').test(text);
  const hasIntro = keyWithString('intro').test(text);
  const inSegments = SEGMENTS_KEY.test(text);
  const started = inSegments ? (text.match(TITLE_KEY) || []).length : 0;
  const drafted = inSegments ? (text.match(TRANSITION) || []).length : 0;
  const inQuestions = GUEST_QUESTIONS_KEY.test(text);
  const inOutro = OUTRO_KEY.test(text);

  // The bar uses the fixed estimate, so it can only move forward; the "of about M" text never falls below what has been seen.
  const estimate = expectedSegmentCount(lengthMins);
  const segmentsExpected = Math.max(estimate, started, drafted);

  let stage = 'starting';
  let fraction = 0;
  const reach = (nextStage, nextFraction) => {
    if (nextFraction > fraction) {
      stage = nextStage;
      fraction = nextFraction;
    }
  };
  if (text.length > 0) reach('starting', 0.02);
  if (hasTitle) reach('title', 0.06);
  if (hasIntro) reach('intro', 0.12);
  if (inSegments) reach('segments', 0.13 + 0.67 * Math.min(1, (drafted + 0.5 * Math.max(0, started - drafted)) / estimate)); // a segment that has begun counts as half
  if (inQuestions) reach('questions', 0.85);
  if (inOutro) reach('outro', 0.93);

  return {
    stage,
    fraction: Math.min(0.95, Number(fraction.toFixed(3))),
    segmentsDrafted: drafted,
    segmentsExpected,
    chars: text.length,
  };
}
