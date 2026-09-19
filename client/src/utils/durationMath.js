export function sumDurations(segments) {
  return (segments || []).reduce((total, s) => total + (Number(s.duration_mins) || 0), 0);
}

/** Each segment's percentage share of the total, for the timeline bar. Sums to ~100 (rounding may drift by a point or two). */
export function toTimelineShares(segments) {
  const total = sumDurations(segments) || 1;
  return (segments || []).map((s) => ({
    id: s.id,
    title: s.title,
    percent: Math.max(((Number(s.duration_mins) || 0) / total) * 100, 0),
  }));
}
