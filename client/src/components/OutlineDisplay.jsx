import { Save, Share2 } from 'lucide-react';
import SegmentCard from './SegmentCard.jsx';
import TimelineBar from './TimelineBar.jsx';
import GuestQuestions from './GuestQuestions.jsx';
import ExportPanel from './ExportPanel.jsx';
import Spinner from './Spinner.jsx';
import { inputClasses } from './FormField.jsx';

export default function OutlineDisplay({ workspace, activeSegmentId, onExpandSegment, onSaveProject, saving, onShare, sharing, isReadOnly }) {
  const { outline, form, totalDurationLive, updateOutlineField, updateSegment, updateTalkingPoint, addTalkingPoint, removeTalkingPoint } =
    workspace;

  const meta = { podcastName: form.podcastName, hostCount: form.hostCount };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface-raised shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={outline.episode_title}
              onChange={(e) => updateOutlineField('episode_title', e.target.value)}
              disabled={isReadOnly}
              aria-label="Episode title"
              className="w-full bg-transparent text-xl font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 -mx-1 disabled:opacity-100"
            />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-medium rounded-full bg-accent-subtle text-accent px-2.5 py-1">{outline.tone}</span>
              <span className="text-xs text-ink-muted">{totalDurationLive} min total</span>
            </div>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onSaveProject}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:border-ink-faint disabled:opacity-60 transition-colors"
              >
                {saving ? <Spinner className="w-4 h-4" label="Saving" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                Save project
              </button>
              <button
                type="button"
                onClick={onShare}
                disabled={sharing}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:border-ink-faint disabled:opacity-60 transition-colors"
              >
                {sharing ? <Spinner className="w-4 h-4" label="Creating link" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
                Share
              </button>
              <ExportPanel outline={outline} meta={meta} />
            </div>
          )}
          {isReadOnly && <ExportPanel outline={outline} meta={meta} />}
        </div>

        <div className="mt-4">
          <TimelineBar segments={outline.segments} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised shadow-card p-5">
        <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Intro</h2>
        <textarea
          value={outline.intro}
          onChange={(e) => updateOutlineField('intro', e.target.value)}
          disabled={isReadOnly}
          rows={3}
          className={`${inputClasses} resize-none disabled:opacity-100 disabled:bg-transparent disabled:border-transparent disabled:px-0`}
        />
      </section>

      <div className="space-y-4">
        {outline.segments.map((segment, index) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            index={index}
            isActiveDeepDive={segment.id === activeSegmentId}
            isReadOnly={isReadOnly}
            onUpdate={(patch) => !isReadOnly && updateSegment(segment.id, patch)}
            onUpdateTalkingPoint={(i, value) => !isReadOnly && updateTalkingPoint(segment.id, i, value)}
            onAddTalkingPoint={() => !isReadOnly && addTalkingPoint(segment.id)}
            onRemoveTalkingPoint={(i) => !isReadOnly && removeTalkingPoint(segment.id, i)}
            onExpand={() => onExpandSegment(segment)}
          />
        ))}
      </div>

      <GuestQuestions workspace={workspace} isReadOnly={isReadOnly} />

      <section className="rounded-2xl border border-border bg-surface-raised shadow-card p-5">
        <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Outro</h2>
        <textarea
          value={outline.outro}
          onChange={(e) => updateOutlineField('outro', e.target.value)}
          disabled={isReadOnly}
          rows={2}
          className={`${inputClasses} resize-none disabled:opacity-100 disabled:bg-transparent disabled:border-transparent disabled:px-0`}
        />
      </section>
    </div>
  );
}
