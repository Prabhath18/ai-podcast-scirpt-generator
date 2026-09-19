import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import EditableText from './EditableText.jsx';
import SegmentRow from './SegmentRow.jsx';
import GuestQuestions from './GuestQuestions.jsx';
import { OUTLINE_LIMITS } from '../hooks/constants.js';
import { segmentTimings } from '../utils/durationMath.js';

/** Intro and outro share one shape: a gutter label and a block of reading text. */
function ScriptBlock({ label, heading, value, readOnly, onCommit, placeholder }) {
  return (
    <section aria-label={heading} className="grid grid-cols-[2.25rem_1fr] gap-x-3 border-t border-line px-2 py-5 sm:grid-cols-[3.25rem_1fr] sm:px-3">
      <p className="label pt-1.5" aria-hidden="true">{label}</p>
      <div>
        <h2 className="font-serif text-lg font-semibold">{heading}</h2>
        <div className="mt-2 max-w-measure font-serif text-prose">
          <EditableText multiline value={value} label={heading.toLowerCase()} readOnly={readOnly} placeholder={placeholder} onCommit={onCommit} />
        </div>
      </div>
    </section>
  );
}

/**
 * The outline as a document: title block, intro, numbered segments, guest
 * questions, outro. With `readOnly` (the shared page) nothing is editable.
 */
export default function OutlineDocument({
  workspace,
  readOnly,
  activeSegmentId,
  activePanelTab,
  openCommentCounts,
  onSelectSegment,
  onOpenPanel,
}) {
  const { outline, form, totalDurationLive, updateOutlineField, updateSegment, reorderSegments, updateTalkingPoint, addTalkingPoint, removeTalkingPoint, removeSegment, unpinSource } = workspace;
  const { segments } = outline;
  const timings = segmentTimings(segments);
  const teaser = outline.intro_outro?.teaser?.trim();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const describe = (id) => {
    const index = segments.findIndex((s) => s.id === id);
    return `segment ${index + 1}, ${segments[index]?.title}`;
  };
  const position = (id) => segments.findIndex((s) => s.id === id) + 1;
  const announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}. Use the arrow keys to move it, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${describe(active.id)} is over position ${position(over.id)} of ${segments.length}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${describe(active.id)} at position ${position(over.id)}.` : 'Dropped. Nothing changed.'),
    onDragCancel: ({ active }) => `Cancelled. ${describe(active.id)} stays where it was.`,
  };

  return (
    <div>
      <header className="pb-6">
        <p className="label">{form.podcastName || 'Episode outline'}</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold">
          <EditableText value={outline.episode_title} label="episode title" required readOnly={readOnly} onCommit={(v) => updateOutlineField('episode_title', v)} />
        </h1>
        <p className="tabular mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-muted">
          <span>{outline.tone}</span>
          <span>{totalDurationLive} min</span>
          <span>{segments.length} segments</span>
        </p>
        {teaser && <p className="mt-3 max-w-measure font-serif text-prose italic text-ink-muted">{teaser}</p>}
      </header>

      <ScriptBlock label="Open" heading="Intro" value={outline.intro} readOnly={readOnly} placeholder="Write the opening" onCommit={(v) => updateOutlineField('intro', v)} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={{ announcements }} onDragEnd={({ active, over }) => over && active.id !== over.id && reorderSegments(active.id, over.id)}>
        <SortableContext items={segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol aria-label="Segments">
            {segments.map((segment, index) => (
              <SegmentRow
                key={segment.id}
                segment={segment}
                index={index}
                timing={timings[index]}
                isActive={segment.id === activeSegmentId}
                readOnly={readOnly}
                openComments={openCommentCounts[segment.id] || 0}
                activePanelTab={activePanelTab}
                canRemove={segments.length > OUTLINE_LIMITS.MIN_SEGMENTS}
                onSelect={() => onSelectSegment(segment.id)}
                onOpenPanel={(tab) => onOpenPanel(tab, segment.id)}
                onUpdate={(patch) => updateSegment(segment.id, patch)}
                onUpdateTalkingPoint={(i, value) => updateTalkingPoint(segment.id, i, value)}
                onAddTalkingPoint={() => addTalkingPoint(segment.id)}
                onRemoveTalkingPoint={(i) => removeTalkingPoint(segment.id, i)}
                onRemove={() => removeSegment(segment)}
                onUnpin={(source) => unpinSource(segment.id, source)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <GuestQuestions workspace={workspace} readOnly={readOnly} />

      <ScriptBlock label="Close" heading="Outro" value={outline.outro} readOnly={readOnly} placeholder="Write the closing" onCommit={(v) => updateOutlineField('outro', v)} />
    </div>
  );
}
