// Turns the raw "variations" LLM payload into validated, duration-normalized
// { approach, rationale, outline } items. Written as a validator for
// callStructuredLLM: if some variations are invalid it asks for one retry,
// and if the retry is still partly invalid the valid ones are returned
// (`salvage`) so the user sees what worked instead of an error.
import { validateVariation } from '../validators/outlineSchema.js';
import { normalizeDurations } from '../utils/duration.js';

function assemble(raw, { tone, lengthMins, includeGuests }) {
  const segments = Array.isArray(raw?.segments)
    ? raw.segments.map((segment, index) => ({ ...segment, id: index + 1 }))
    : raw?.segments;
  return {
    approach: typeof raw?.approach === 'string' ? raw.approach.trim() : raw?.approach,
    rationale: typeof raw?.rationale === 'string' ? raw.rationale.trim() : raw?.rationale,
    outline: {
      episode_title: raw?.episode_title,
      tone,
      total_duration_mins: lengthMins,
      intro: raw?.intro,
      segments,
      guest_questions: includeGuests && Array.isArray(raw?.guest_questions) ? raw.guest_questions : [],
      outro: raw?.outro,
    },
  };
}

export function buildVariationsValidator(context) {
  const { count, lengthMins } = context;

  return (data) => {
    const raw = Array.isArray(data?.variations) ? data.variations : [];
    const usable = [];
    const errors = [];
    const seenApproaches = new Set();

    raw.forEach((item, index) => {
      const variation = assemble(item, context);
      const result = validateVariation(variation);
      if (!result.valid) {
        errors.push({ field: `variations[${index}]`, message: 'Invalid variation.', details: result.errors });
        return;
      }
      const key = variation.approach.toLowerCase();
      if (seenApproaches.has(key)) {
        errors.push({ field: `variations[${index}]`, message: `Duplicate approach "${variation.approach}"; each variation needs a different structure.` });
        return;
      }
      seenApproaches.add(key);
      variation.outline.segments = normalizeDurations(variation.outline.segments, lengthMins);
      usable.push(variation);
    });

    if (raw.length < count) {
      errors.push({ field: 'variations', message: `Expected ${count} variations but received ${raw.length}.` });
    }

    const variations = usable.slice(0, count);
    return {
      valid: errors.length === 0,
      errors,
      value: { variations },
      salvage: variations.length > 0 ? { variations } : undefined,
    };
  };
}
