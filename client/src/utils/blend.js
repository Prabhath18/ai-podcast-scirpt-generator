// Pure helpers for the Variations view: promote a whole variation to be the
// working outline, or copy single segments across ("blend") while keeping the
// episode's total length steady.
import { OUTLINE_LIMITS } from '../hooks/constants.js';
import { normalizeDurations, sumDurations } from './durationMath.js';

function nextSegmentId(segments) {
  return segments.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

/** A copy of a variation's segment that is safe to drop into another outline: fresh id, no pinned sources. */
function toIncoming(segment, segments) {
  const { sources, ...rest } = segment; // eslint-disable-line no-unused-vars -- sources belong to the source outline
  return { ...rest, talking_points: [...segment.talking_points], id: nextSegmentId(segments) };
}

/**
 * Copies `incoming` into `segments`.
 *   mode "add"      appends it (refused once the outline is at the segment limit)
 *   mode "replace"  swaps it in for the segment with `targetId`
 * Durations are re-normalized so the total stays what it was before the blend.
 * Returns the new segments array, or null when the blend isn't allowed.
 */
export function blendSegment(segments, incoming, { mode, targetId }) {
  const total = sumDurations(segments);
  const copy = toIncoming(incoming, segments);

  let next;
  if (mode === 'add') {
    if (segments.length >= OUTLINE_LIMITS.MAX_SEGMENTS) return null;
    next = [...segments, copy];
  } else if (mode === 'replace') {
    if (!segments.some((s) => s.id === targetId)) return null;
    next = segments.map((s) => (s.id === targetId ? copy : s));
  } else {
    return null;
  }
  return normalizeDurations(next, total);
}

/**
 * Makes a variation the working outline. Everything about the episode's shape
 * (title, intro, segments, guest questions, outro) comes from the variation;
 * the stored variations list and any intro/outro set are kept as they were.
 */
export function applyVariation(outline, variation) {
  const { episode_title, intro, segments, guest_questions, outro } = variation.outline;
  return { ...outline, episode_title, intro, segments, guest_questions, outro };
}

/** Facts for a variation's header: how many segments it has and how long it runs. */
export function variationSummary(variation) {
  const { segments, total_duration_mins } = variation.outline;
  return { segmentCount: segments.length, totalMins: sumDurations(segments) || total_duration_mins };
}
