import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Sparkles } from 'lucide-react';
import { OUTLINE_LIMITS } from '../hooks/constants.js';
import { inputClasses } from './FormField.jsx';

export default function SegmentCard({
  segment,
  index,
  isActiveDeepDive,
  isReadOnly,
  onUpdate,
  onUpdateTalkingPoint,
  onAddTalkingPoint,
  onRemoveTalkingPoint,
  onExpand,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const atMinPoints = segment.talking_points.length <= OUTLINE_LIMITS.MIN_TALKING_POINTS;
  const atMaxPoints = segment.talking_points.length >= OUTLINE_LIMITS.MAX_TALKING_POINTS;

  return (
    <article
      className={`rounded-2xl border bg-surface-raised shadow-card transition-colors ${
        isActiveDeepDive ? 'border-accent' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span
          className="shrink-0 w-8 h-8 rounded-full bg-accent-subtle text-accent font-semibold text-sm flex items-center justify-center mt-0.5"
          aria-hidden="true"
        >
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={segment.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              disabled={isReadOnly}
              aria-label={`Segment ${index + 1} title`}
              className="flex-1 min-w-[10rem] bg-transparent font-semibold text-ink text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 -mx-1 disabled:opacity-100"
            />
            <label className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted">
              <input
                type="number"
                min={1}
                max={60}
                value={segment.duration_mins}
                onChange={(e) => onUpdate({ duration_mins: Number(e.target.value) || 0 })}
                disabled={isReadOnly}
                aria-label={`Segment ${index + 1} duration in minutes`}
                className="w-9 bg-transparent text-right focus:outline-none disabled:opacity-100"
              />
              min
            </label>
          </div>

          <div className="flex items-center gap-1 mt-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={onExpand}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover px-2 py-1 -ml-2 rounded-md hover:bg-accent-subtle transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Deep Dive
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint hover:text-ink-muted px-2 py-1 rounded-md hover:bg-surface-sunken transition-colors"
            >
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              {collapsed ? 'Show details' : 'Hide details'}
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-3">
          <ul className="space-y-2">
            {segment.talking_points.map((point, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-faint shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={point}
                  onChange={(e) => onUpdateTalkingPoint(i, e.target.value)}
                  disabled={isReadOnly}
                  aria-label={`Segment ${index + 1} talking point ${i + 1}`}
                  className={`${inputClasses} py-1.5 disabled:opacity-100 disabled:bg-transparent disabled:border-transparent disabled:px-0`}
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveTalkingPoint(i)}
                    disabled={atMinPoints}
                    aria-label={`Remove talking point ${i + 1}`}
                    title={atMinPoints ? `Segments need at least ${OUTLINE_LIMITS.MIN_TALKING_POINTS} talking points` : 'Remove'}
                    className="p-1.5 rounded-md text-ink-faint hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!isReadOnly && (
            <button
              type="button"
              onClick={onAddTalkingPoint}
              disabled={atMaxPoints}
              title={atMaxPoints ? `Segments allow at most ${OUTLINE_LIMITS.MAX_TALKING_POINTS} talking points` : 'Add talking point'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add talking point
            </button>
          )}

          <div>
            <label htmlFor={`transition-${segment.id}`} className="block text-xs font-medium text-ink-faint mb-1">
              Transition to next segment
            </label>
            <input
              id={`transition-${segment.id}`}
              type="text"
              value={segment.transition}
              onChange={(e) => onUpdate({ transition: e.target.value })}
              disabled={isReadOnly}
              className={`${inputClasses} italic disabled:opacity-100 disabled:bg-transparent disabled:border-transparent disabled:px-0`}
            />
          </div>
        </div>
      )}
    </article>
  );
}
