import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EditableText from './EditableText.jsx';
import { OUTLINE_LIMITS } from '../hooks/constants.js';

const pad = (n) => String(n).padStart(2, '0');

function Grip() {
  return (
    <svg viewBox="0 0 10 16" className="h-4 w-2.5" fill="currentColor" aria-hidden="true">
      {[2, 8, 14].flatMap((y) => [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}
    </svg>
  );
}

/**
 * One segment of the episode, laid out like a line in a script: a gutter with
 * its number and start time, then title, duration, talking points and the
 * actions that open the side panel. Drag the grip (or focus it and press
 * Space, then the arrow keys) to reorder.
 */
export default function SegmentRow({
  segment,
  index,
  timing,
  isActive,
  readOnly,
  openComments,
  activePanelTab,
  canRemove,
  onSelect,
  onOpenPanel,
  onUpdate,
  onUpdateTalkingPoint,
  onAddTalkingPoint,
  onRemoveTalkingPoint,
  onRemove,
  onUnpin,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
    disabled: readOnly,
  });
  const points = segment.talking_points;
  const number = pad(index + 1);
  const sources = segment.sources || [];
  const label = `segment ${index + 1}`;

  return (
    <li
      ref={setNodeRef}
      id={`segment-${segment.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      onFocusCapture={onSelect}
      data-active={isActive}
      className={`group relative scroll-mt-40 border-t border-line px-2 py-5 sm:px-3 ${
        isActive ? 'bg-accent-tint/40 shadow-[inset_2px_0_0_rgb(var(--accent))]' : ''
      } ${isDragging ? 'z-10 bg-page shadow-float' : ''}`}
    >
      <div className="grid grid-cols-[2.25rem_1fr] gap-x-3 sm:grid-cols-[3.25rem_1fr]">
        <div className="flex flex-col items-start gap-2 pt-1">
          <span className="tabular font-mono text-sm font-medium text-ink-muted" aria-hidden="true">{number}</span>
          {!readOnly && (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${label}: ${segment.title}`}
              className="-ml-1 cursor-grab touch-none rounded-sm p-1 text-ink-faint opacity-0 transition-opacity duration-150 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
            >
              <Grip />
            </button>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h3 className="min-w-0 flex-1 font-serif text-lg font-semibold">
              <EditableText value={segment.title} label={`title of ${label}`} required readOnly={readOnly} onCommit={(title) => onUpdate({ title })} />
            </h3>
            <div className="tabular w-[4.25rem] shrink-0 text-right font-mono text-sm text-ink-muted">
              <EditableText value={segment.duration_mins} suffix=" min" numeric readOnly={readOnly} label={`duration of ${label}, in minutes`} className="text-right" onCommit={(duration_mins) => onUpdate({ duration_mins })} />
            </div>
          </div>
          <p className="tabular mt-0.5 font-mono text-xs text-ink-faint">
            {timing.start} to {timing.end}
            {collapsed && ` · ${points.length} points`}
          </p>

          {!collapsed && (
            <>
              <ul className="mt-3 space-y-1.5">
                {points.map((point, i) => (
                  <li key={i} className="group/point flex items-start gap-2.5">
                    <span className="mt-[0.8em] h-px w-2.5 shrink-0 bg-ink-faint" aria-hidden="true" />
                    <div className="max-w-measure flex-1 text-base">
                      <EditableText multiline value={point} label={`talking point ${i + 1} of ${label}`} readOnly={readOnly} placeholder="Write a talking point" onCommit={(value) => onUpdateTalkingPoint(i, value)} />
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onRemoveTalkingPoint(i)}
                        disabled={points.length <= OUTLINE_LIMITS.MIN_TALKING_POINTS}
                        aria-label={`Remove talking point ${i + 1} of ${label}`}
                        title={points.length <= OUTLINE_LIMITS.MIN_TALKING_POINTS ? `A segment keeps at least ${OUTLINE_LIMITS.MIN_TALKING_POINTS} points` : 'Remove'}
                        className="btn btn-quiet h-6 w-6 px-0 text-base leading-none text-ink-faint opacity-0 focus-visible:opacity-100 group-hover/point:opacity-100 disabled:hidden [@media(hover:none)]:opacity-100"
                      >
                        &times;
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!readOnly && points.length < OUTLINE_LIMITS.MAX_TALKING_POINTS && (
                <button type="button" onClick={onAddTalkingPoint} className="link-action mt-2">
                  Add a point
                </button>
              )}

              <div className="mt-4 flex max-w-measure items-baseline gap-2.5 font-serif italic text-ink-muted">
                <span className="label shrink-0 not-italic">Then</span>
                <div className="flex-1">
                  <EditableText value={segment.transition} label={`transition after ${label}`} readOnly={readOnly} placeholder="Add a transition line" onCommit={(transition) => onUpdate({ transition })} />
                </div>
              </div>

              {sources.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="label mb-1.5">Sources, verify before citing</p>
                  <ul className="space-y-1">
                    {sources.map((source) => (
                      <li key={source.url} className="flex items-baseline gap-2 text-sm">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                          {source.title}
                        </a>
                        {!readOnly && (
                          <button type="button" onClick={() => onUnpin(source)} aria-label={`Unpin ${source.title}`} className="link-action shrink-0">
                            Unpin
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {!readOnly && (
              <button type="button" className="link-action" data-active={isActive && activePanelTab === 'deep'} onClick={() => onOpenPanel('deep')}>
                Deep Dive
              </button>
            )}
            {!readOnly && (
              <button type="button" className="link-action" data-active={isActive && activePanelTab === 'research'} onClick={() => onOpenPanel('research')}>
                Research
              </button>
            )}
            <button type="button" className="link-action" data-active={isActive && activePanelTab === 'comments'} onClick={() => onOpenPanel('comments')}>
              Comments
              {openComments > 0 && <span className="tabular ml-1 font-mono">{openComments}</span>}
            </button>
            <span className="flex-1" />
            <button type="button" className="link-action" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
            {!readOnly && (
              <button type="button" className="link-action hover:!text-danger hover:!decoration-danger" disabled={!canRemove} title={canRemove ? undefined : `An outline keeps at least ${OUTLINE_LIMITS.MIN_SEGMENTS} segments`} onClick={onRemove}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
