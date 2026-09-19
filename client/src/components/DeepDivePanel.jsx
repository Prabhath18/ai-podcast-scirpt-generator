import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, X, Info } from 'lucide-react';
import { DeepDiveSkeleton } from './SkeletonLoader.jsx';
import EmptyState from './EmptyState.jsx';
import { api, ApiError } from '../services/api.js';
import { segmentContentKey } from '../utils/segmentSnapshot.js';

/**
 * Shared Deep Dive body, used both as the persistent desktop sidebar and
 * inside a mobile bottom-sheet modal (see WorkspacePage.jsx). Owns its own
 * fetch lifecycle against the workspace's per-segment cache.
 */
export default function DeepDivePanel({ activeSegment, workspace, onClose, showCloseButton }) {
  const { outline, form, getDeepDive, setDeepDive, activeProjectId } = workspace;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const cached = activeSegment ? getDeepDive(activeSegment) : null;

  const fetchDeepDive = useCallback(
    async (segment) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const result = await api.post('/api/expand-segment', {
          topic: form.topic.trim() || outline.episode_title,
          tone: form.tone === 'Other' ? form.customTone : form.tone,
          lengthMins: Number(form.lengthMins),
          outline,
          segment,
          projectId: activeProjectId || undefined,
        });
        setDeepDive(segment.id, segmentContentKey(segment), result.deepDive);
      } catch (err) {
        setErrorMsg(err instanceof ApiError ? err.message : 'Could not generate research notes. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [form, outline, activeProjectId, setDeepDive],
  );

  // Auto-fetch the first time a segment is opened; a stale cache entry is
  // shown as-is with a banner instead, so an edit never silently re-spends
  // an LLM call without the user asking for it.
  useEffect(() => {
    if (!activeSegment) return;
    const entry = getDeepDive(activeSegment);
    if (!entry) fetchDeepDive(activeSegment);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the selected segment changes
  }, [activeSegment?.id]);

  if (!activeSegment) {
    return (
      <div className="rounded-2xl border border-border bg-surface-raised shadow-card p-5 h-full">
        <EmptyState
          icon={Sparkles}
          title="Deep Dive"
          description="Click “Deep Dive” on any segment to get 2-3 paragraphs of research notes and follow-up discussion prompts."
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-raised shadow-card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-accent uppercase tracking-wide mb-0.5">Deep Dive</p>
          <h2 className="font-semibold text-ink truncate">{activeSegment.title}</h2>
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Deep Dive panel"
            className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto scrollbar-thin pr-1">
        {loading && <DeepDiveSkeleton />}

        {!loading && errorMsg && (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p className="text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              {errorMsg}
            </p>
            <button
              type="button"
              onClick={() => fetchDeepDive(activeSegment)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Try again
            </button>
          </div>
        )}

        {!loading && !errorMsg && cached && (
          <div className="space-y-4">
            {cached.stale && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <p>This segment changed since these notes were generated.</p>
                  <button
                    type="button"
                    onClick={() => fetchDeepDive(activeSegment)}
                    className="mt-1 inline-flex items-center gap-1.5 font-medium underline underline-offset-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Regenerate now
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 text-sm text-ink leading-relaxed">
              {cached.data.notes.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {cached.data.discussion_prompts?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Follow-up prompts</h3>
                <ul className="space-y-1.5 text-sm text-ink-muted list-disc list-inside">
                  {cached.data.discussion_prompts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {!cached.stale && (
              <button
                type="button"
                onClick={() => fetchDeepDive(activeSegment)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Regenerate
              </button>
            )}

            <p className="flex items-start gap-1.5 text-xs text-ink-faint pt-2 border-t border-border">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              AI-generated, verify facts before using.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
