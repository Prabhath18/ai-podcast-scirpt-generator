import { useCallback, useEffect, useState } from 'react';
import { PanelSkeleton } from './Skeletons.jsx';
import EmptyState from './EmptyState.jsx';
import { api, ApiError } from '../services/api.js';
import { segmentContentKey } from '../utils/segmentSnapshot.js';

/**
 * Deep Dive body: research notes and follow-up prompts for one segment, from a
 * second LLM call that sees the whole outline. Results are cached per segment
 * and marked stale (never silently regenerated) when the segment is edited.
 * Notes are only requested when the user asks: a non-zero `requestId` means they
 * just chose Deep Dive (or pressed E), and the panel clears it via
 * `onRequestHandled` once acted on. Merely selecting a segment spends nothing.
 */
export default function DeepDivePanel({ segment, workspace, requestId, onRequestHandled }) {
  const { outline, form, getDeepDive, setDeepDive, activeProjectId } = workspace;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const cached = segment ? getDeepDive(segment) : null;

  const fetchDeepDive = useCallback(
    async (target) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const result = await api.post('/api/expand-segment', {
          topic: form.topic.trim() || outline.episode_title,
          tone: form.tone === 'Other' ? form.customTone : form.tone,
          lengthMins: Number(form.lengthMins),
          outline,
          segment: target,
          projectId: activeProjectId || undefined,
        });
        setDeepDive(target.id, segmentContentKey(target), result.deepDive);
      } catch (err) {
        setErrorMsg(
          err instanceof ApiError && err.code === 'LLM_NOT_CONFIGURED'
            ? 'Deep Dive needs a Gemini API key on the server. The demo outlines still work; open one from the brief.'
            : err instanceof ApiError
              ? err.message
              : 'Could not write the research notes. Check your connection and try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [form, outline, activeProjectId, setDeepDive],
  );

  // An explicit request writes notes if there are none yet. A stale entry is shown
  // as-is with a banner, so an edit never spends an LLM call unless the user asks.
  useEffect(() => {
    if (!requestId) return;
    onRequestHandled();
    if (segment && !getDeepDive(segment)) fetchDeepDive(segment);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only per explicit request
  }, [requestId]);

  if (!segment) {
    return <EmptyState title="Pick a segment" description="Select a segment, then press E or choose Deep Dive on it. You get research notes and follow-up prompts written for that segment." />;
  }

  return (
    <div>
      {loading && <PanelSkeleton />}

      {!loading && errorMsg && (
        <div className="callout callout-danger" role="alert">
          <p>{errorMsg}</p>
          <button type="button" className="link-action mt-2 !text-danger" onClick={() => fetchDeepDive(segment)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !errorMsg && !cached && (
        <div className="card-muted px-4 py-6">
          <p className="font-serif text-lg font-semibold">No notes for this segment yet</p>
          <p className="mt-1 text-sm text-ink-muted">Deep Dive writes 2 to 3 paragraphs of research and a few follow-up prompts, using the whole outline for context. It uses one request.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => fetchDeepDive(segment)}>Write research notes</button>
        </div>
      )}

      {!loading && !errorMsg && cached && (
        <div className="space-y-5">
          {cached.stale && (
            <div className="callout callout-warn">
              <p>This segment changed after these notes were written.</p>
              <button type="button" className="link-action mt-1 !text-warn" onClick={() => fetchDeepDive(segment)}>
                Rewrite the notes
              </button>
            </div>
          )}

          <div className="space-y-3 font-serif text-prose">
            {cached.data.notes.split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {cached.data.discussion_prompts?.length > 0 && (
            <div>
              <h3 className="label mb-2">If the conversation stalls</h3>
              <ul className="space-y-2 text-sm">
                {cached.data.discussion_prompts.map((prompt, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[0.7em] h-px w-2.5 shrink-0 bg-ink-faint" aria-hidden="true" />
                    <span>{prompt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-xs text-ink-faint">Written by AI. Verify facts before you use them.</p>
            {!cached.stale && (
              <button type="button" className="link-action shrink-0" onClick={() => fetchDeepDive(segment)}>
                Rewrite
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
