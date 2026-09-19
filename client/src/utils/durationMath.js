export function sumDurations(segments) {
  return (segments || []).reduce((total, s) => total + (Number(s.duration_mins) || 0), 0);
}

/**
 * Rescales segment durations so they sum to exactly `targetTotalMins` in whole
 * minutes, each at least 1. Same "largest remainder" method as the server's
 * utils/duration.js, so a blended outline is normalized the same way a
 * freshly generated one is.
 */
export function normalizeDurations(segments, targetTotalMins) {
  if (!Array.isArray(segments) || segments.length === 0) return segments;
  const target = Math.max(Math.round(targetTotalMins) || 0, segments.length);

  const weights = segments.map((s) => Math.max(Number(s.duration_mins) || 0, 0.01));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const exact = weights.map((w) => (w / weightSum) * target);
  const minutes = exact.map((v) => Math.max(1, Math.floor(v)));

  let remainder = target - minutes.reduce((a, b) => a + b, 0);
  const byFraction = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);

  for (let cursor = 0; remainder > 0; cursor++, remainder--) {
    minutes[byFraction[cursor % byFraction.length].i] += 1;
  }
  while (remainder < 0) {
    const longest = minutes.indexOf(Math.max(...minutes));
    if (minutes[longest] <= 1) break;
    minutes[longest] -= 1;
    remainder += 1;
  }

  return segments.map((segment, i) => ({ ...segment, duration_mins: minutes[i] }));
}

const pad = (n) => String(n).padStart(2, '0');

/** Minutes -> "MM:SS", or "H:MM:SS" once `withHours` is set (episodes an hour or longer). */
export function formatClock(mins, withHours = false) {
  const totalSeconds = Math.round(mins * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return withHours ? `${h}:${pad(m)}:${pad(s)}` : `${pad(h * 60 + m)}:${pad(s)}`;
}

/** Running clock for each segment: [{ id, start: "00:00", end: "06:00" }, ...]. */
export function segmentTimings(segments) {
  const withHours = sumDurations(segments) >= 60;
  let elapsed = 0;
  return (segments || []).map((s) => {
    const start = elapsed;
    elapsed += Number(s.duration_mins) || 0;
    return { id: s.id, start: formatClock(start, withHours), end: formatClock(elapsed, withHours) };
  });
}
