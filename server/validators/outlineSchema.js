// Structural + business-rule validation for outline objects, whether they
// came fresh from the LLM or from a client PUT request. Kept dependency-free
// (no zod/ajv) so the rules are easy to read and easy to unit test.
import { validateIntroOutro } from './introOutroSchema.js';

const MIN_SEGMENTS = 5;
const MAX_SEGMENTS = 8;
const MIN_TALKING_POINTS = 3;
const MAX_TALKING_POINTS = 5;
const MAX_VARIATIONS = 3;
const MAX_SOURCES_PER_SEGMENT = 10;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value) && value.length <= 500;
}

// Sources a user pinned to a segment (see routes/research.js). Optional, so
// outlines saved before this feature existed stay valid.
function validateSources(sources, label, errors) {
  if (!Array.isArray(sources)) {
    pushError(errors, label, 'sources must be an array.');
    return;
  }
  if (sources.length > MAX_SOURCES_PER_SEGMENT) {
    pushError(errors, label, `A segment can pin at most ${MAX_SOURCES_PER_SEGMENT} sources.`);
  }
  sources.forEach((source, i) => {
    if (!source || !isNonEmptyString(source.title) || !isHttpUrl(source.url) || typeof source.summary !== 'string') {
      pushError(errors, `${label}[${i}]`, 'Each source needs a title, an http(s) url and a summary.');
    }
  });
}

// Alternative outlines stored next to the working one: { approach, rationale, outline }.
function validateVariations(variations, errors) {
  if (!Array.isArray(variations)) {
    pushError(errors, 'variations', 'variations must be an array.');
    return;
  }
  if (variations.length > MAX_VARIATIONS) {
    pushError(errors, 'variations', `At most ${MAX_VARIATIONS} variations are stored.`);
  }
  variations.forEach((variation, i) => {
    const label = `variations[${i}]`;
    const result = validateVariation(variation);
    result.errors.forEach((e) => pushError(errors, `${label}.${e.field}`, e.message));
  });
}

/** One variation: { approach, rationale, outline } where outline is a complete, valid outline. */
export function validateVariation(variation) {
  const errors = [];
  if (!variation || typeof variation !== 'object') {
    return { valid: false, errors: [{ field: 'variation', message: 'Variation must be an object.' }] };
  }
  if (!isNonEmptyString(variation.approach) || variation.approach.length > 80) {
    pushError(errors, 'approach', 'approach is required (80 characters or fewer).');
  }
  if (typeof variation.rationale !== 'string' || variation.rationale.length > 400) {
    pushError(errors, 'rationale', 'rationale must be a string (400 characters or fewer).');
  }
  const inner = validateOutline(variation.outline, { isVariation: true });
  inner.errors.forEach((e) => pushError(errors, `outline.${e.field}`, e.message));
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an outline object against the shared schema:
 * { episode_title, tone, total_duration_mins, intro, segments[], guest_questions[], outro }
 * plus the optional fields added later: `variations[]`, `intro_outro`, and
 * `sources[]` on each segment.
 *
 * Returns { valid: boolean, errors: [{ field, message }] }. Never throws --
 * callers decide whether an invalid outline is a hard failure (LLM response)
 * or a 400 response (user-submitted edit).
 */
export function validateOutline(outline, { isVariation = false } = {}) {
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

  if (outline.variations !== undefined) {
    if (isVariation) pushError(errors, 'variations', 'A variation cannot contain its own variations.');
    else validateVariations(outline.variations, errors);
  }

  if (outline.intro_outro !== undefined) {
    const stored = validateIntroOutro(outline.intro_outro);
    stored.errors.forEach((e) => pushError(errors, `intro_outro.${e.field}`, e.message));
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
    if (segment.sources !== undefined) validateSources(segment.sources, `${label}.sources`, errors);
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
  MAX_VARIATIONS,
  MAX_SOURCES_PER_SEGMENT,
};
