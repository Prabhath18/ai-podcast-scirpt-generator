// The LLM is asked for a target total length, but individual segment
// durations it invents rarely add up exactly. This rescales them
// proportionally and rounds with the "largest remainder" method so the
// segments sum to *exactly* the target while staying whole minutes and
// keeping each segment at least 1 minute.

/**
 * @param {{duration_mins:number}[]} segments
 * @param {number} targetTotalMins
 * @returns {{duration_mins:number}[]} new array, same length/order, same
 *   objects' other fields spread through untouched.
 */
export function normalizeDurations(segments, targetTotalMins) {
  if (!Array.isArray(segments) || segments.length === 0) return segments;
  const target = Math.max(Math.round(targetTotalMins) || 0, segments.length);

  const rawWeights = segments.map((s) => Math.max(Number(s.duration_mins) || 0, 0.01));
  const rawSum = rawWeights.reduce((a, b) => a + b, 0);

  const exact = rawWeights.map((w) => (w / rawSum) * target);
  const floored = exact.map((v) => Math.max(1, Math.floor(v)));

  let remainder = target - floored.reduce((a, b) => a + b, 0);

  // Distribute the leftover minutes to the segments whose fractional part
  // was largest, so the rounding error is spread rather than dumped on one
  // segment.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    floored[order[cursor % order.length].i] += 1;
    remainder -= 1;
    cursor += 1;
  }
  while (remainder < 0) {
    // Target was smaller than segments.length * 1min floor; pull minutes
    // back from the longest segments first without going below 1.
    let idx = floored.indexOf(Math.max(...floored));
    if (floored[idx] <= 1) break;
    floored[idx] -= 1;
    remainder += 1;
  }

  return segments.map((segment, i) => ({ ...segment, duration_mins: floored[i] }));
}

export function sumDurations(segments) {
  return (segments || []).reduce((total, s) => total + (Number(s.duration_mins) || 0), 0);
}
