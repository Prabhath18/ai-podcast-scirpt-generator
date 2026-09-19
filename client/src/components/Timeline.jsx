import { formatClock, sumDurations } from '../utils/durationMath.js';

const scrollToSegment = (id) => {
  const target = document.getElementById(`segment-${id}`);
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

/**
 * The episode as one bar: each block's width is its share of the runtime.
 * Click a block to jump to that segment; the active segment is filled.
 */
export default function Timeline({ segments, activeId, onSelect }) {
  const total = sumDurations(segments);

  return (
    <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 pb-2 sm:px-6">
      <p className="label w-[4.75rem] shrink-0 leading-tight">
        Runtime
        <span className="tabular block text-sm font-medium normal-case text-ink">{formatClock(total, total >= 60)}</span>
      </p>
      <ol className="flex h-7 min-w-0 flex-1 gap-px" aria-label="Episode timeline">
        {segments.map((segment, index) => {
          const active = segment.id === activeId;
          return (
            <li key={segment.id} style={{ flex: `${Number(segment.duration_mins) || 1} 1 0` }} className="min-w-[14px]">
              <button
                type="button"
                onClick={() => {
                  onSelect?.(segment.id);
                  scrollToSegment(segment.id);
                }}
                title={`${segment.title} (${segment.duration_mins} min)`}
                aria-label={`Segment ${index + 1}: ${segment.title}, ${segment.duration_mins} minutes. Jump to segment.`}
                aria-current={active ? 'true' : undefined}
                className={`tabular h-full w-full overflow-hidden rounded-sm font-mono text-2xs transition-colors duration-150 ${
                  active ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink-muted hover:bg-line-strong hover:text-ink'
                }`}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
