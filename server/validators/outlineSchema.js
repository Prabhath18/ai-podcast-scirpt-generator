// Structural + business-rule validation for outline objects, whether they
// came fresh from the LLM or from a client PUT request. Kept dependency-free
// (no zod/ajv) so the rules are easy to read and easy to unit test.

const MIN_SEGMENTS = 5;
const MAX_SEGMENTS = 8;
const MIN_TALKING_POINTS = 3;
const MAX_TALKING_POINTS = 5;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushError(errors, field, message) {
  errors.push({ field, message });
}

/**
 * Validates an outline object against the shared schema:
 * { episode_title, tone, total_duration_mins, intro, segments[], guest_questions[], outro }
 *
 * Returns { valid: boolean, errors: [{ field, message }] }. Never throws --
 * callers decide whether an invalid outline is a hard failure (LLM response)
 * or a 400 response (user-submitted edit).
 */
export function validateOutline(outline) {
  const errors = [];

  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) {
    return { valid: false, errors: [{ field: 'outline', message: 'Outline must be an object.' }] };
  }

  if (!isNonEmptyString(outline.episode_title)) {
    pushError(errors, 'episode_title', 'episode_title is required and must be a non-empty string.');
  }

  if (!isNonEmptyString(outline.tone)) {
    pushError(errors, 'tone', 'tone is required and must be a non-empty string.');
  }

  if (typeof outline.total_duration_mins !== 'number' || outline.total_duration_mins <= 0) {
    pushError(errors, 'total_duration_mins', 'total_duration_mins must be a positive number.');
  }

  if (typeof outline.intro !== 'string') {
    pushError(errors, 'intro', 'intro must be a string (may be empty while a draft).');
  }

  if (typeof outline.outro !== 'string') {
    pushError(errors, 'outro', 'outro must be a string (may be empty while a draft).');
  }

  if (!Array.isArray(outline.guest_questions)) {
    pushError(errors, 'guest_questions', 'guest_questions must be an array of strings.');
  } else if (outline.guest_questions.some((q) => typeof q !== 'string')) {
    pushError(errors, 'guest_questions', 'Every guest question must be a string.');
  }

  if (!Array.isArray(outline.segments)) {
    pushError(errors, 'segments', 'segments must be an array.');
    return { valid: errors.length === 0, errors };
  }

  if (outline.segments.length < MIN_SEGMENTS || outline.segments.length > MAX_SEGMENTS) {
    pushError(
      errors,
      'segments',
      `segments must contain between ${MIN_SEGMENTS} and ${MAX_SEGMENTS} items (got ${outline.segments.length}).`,
    );
  }

  outline.segments.forEach((segment, index) => {
    const label = `segments[${index}]`;

    if (!segment || typeof segment !== 'object') {
      pushError(errors, label, 'Each segment must be an object.');
      return;
    }
    if (typeof segment.id !== 'number') {
      pushError(errors, `${label}.id`, 'Segment id must be a number.');
    }
    if (!isNonEmptyString(segment.title)) {
      pushError(errors, `${label}.title`, 'Segment title is required.');
    }
    if (typeof segment.duration_mins !== 'number' || segment.duration_mins <= 0) {
      pushError(errors, `${label}.duration_mins`, 'Segment duration_mins must be a positive number.');
    }
    if (typeof segment.transition !== 'string') {
      pushError(errors, `${label}.transition`, 'Segment transition must be a string (may be empty).');
    }
    if (!Array.isArray(segment.talking_points)) {
      pushError(errors, `${label}.talking_points`, 'talking_points must be an array of strings.');
    } else {
      if (
        segment.talking_points.length < MIN_TALKING_POINTS ||
        segment.talking_points.length > MAX_TALKING_POINTS
      ) {
        pushError(
          errors,
          `${label}.talking_points`,
          `talking_points must contain between ${MIN_TALKING_POINTS} and ${MAX_TALKING_POINTS} items (got ${segment.talking_points.length}).`,
        );
      }
      if (segment.talking_points.some((p) => typeof p !== 'string' || !p.trim())) {
        pushError(errors, `${label}.talking_points`, 'Every talking point must be a non-empty string.');
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

export const OUTLINE_LIMITS = {
  MIN_SEGMENTS,
  MAX_SEGMENTS,
  MIN_TALKING_POINTS,
  MAX_TALKING_POINTS,
};
