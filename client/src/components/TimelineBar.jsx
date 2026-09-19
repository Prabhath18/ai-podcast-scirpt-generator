import { toTimelineShares } from '../utils/durationMath.js';

/** A single horizontal bar showing each segment's share of the episode. Alternating accent shades keep it legible without introducing a rainbow palette. */
export default function TimelineBar({ segments }) {
  const shares = toTimelineShares(segments);
  if (shares.length === 0) return null;

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken gap-px" role="img" aria-label="Episode timeline by segment">
        {shares.map((s, i) => (
          <div
            key={s.id}
            tabIndex={0}
            title={`${s.title} -- ${Math.round(s.percent)}% of the episode`}
            style={{ width: `${s.percent}%` }}
            className={`h-full transition-opacity hover:opacity-80 focus:opacity-80 ${i % 2 === 0 ? 'bg-accent' : 'bg-accent/60'}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-ink-faint">
        <span>Segment 1</span>
        <span>Segment {shares.length}</span>
      </div>
    </div>
  );
}
