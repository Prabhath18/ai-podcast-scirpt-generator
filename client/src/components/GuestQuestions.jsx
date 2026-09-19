import EditableText from './EditableText.jsx';
import Spinner from './Spinner.jsx';
import { useAsyncCallback } from '../hooks/useAsyncCallback.js';
import { useToast } from '../hooks/useToast.jsx';
import { api, ApiError } from '../services/api.js';

export default function GuestQuestions({ workspace, readOnly }) {
  const { form, outline, updateGuestQuestion, addGuestQuestion, removeGuestQuestion, setGuestQuestions, trackPodcast } = workspace;
  const toast = useToast();

  const regenerate = async () => {
    const isCurrent = trackPodcast();
    const result = await api.post('/api/guest-questions', {
      topic: form.topic.trim() || outline.episode_title,
      tone: form.tone === 'Other' ? form.customTone : form.tone,
      lengthMins: Number(form.lengthMins),
      guestNames: form.guestNames.trim(),
      guestBio: form.guestBio.trim(),
      outline,
    });
    if (!isCurrent()) return false; // another podcast is on screen now
    setGuestQuestions(result.questions);
    return true;
  };
  const { run: runRegenerate, loading } = useAsyncCallback(regenerate);

  const handleRegenerate = async () => {
    try {
      if (await runRegenerate()) toast.success('Guest questions refreshed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not refresh the guest questions.', {
        action: { label: 'Try again', onClick: handleRegenerate },
      });
    }
  };

  const questions = outline.guest_questions;
  if (readOnly && questions.length === 0) return null;

  return (
    <section aria-labelledby="guest-heading" className="grid grid-cols-[2.25rem_1fr] gap-x-3 border-t border-line px-2 py-5 sm:grid-cols-[3.25rem_1fr] sm:px-3">
      <p className="label pt-2" aria-hidden="true">Guest</p>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="guest-heading" className="font-serif text-lg font-semibold">Guest questions</h2>
          {!readOnly && (
            <button type="button" className="link-action inline-flex items-center gap-1.5" onClick={handleRegenerate} disabled={loading}>
              {loading && <Spinner className="h-3 w-3" label="Refreshing" />}
              Regenerate
            </button>
          )}
        </div>

        {questions.length === 0 ? (
          <p className="mt-2 max-w-measure text-sm text-ink-muted">
            No questions yet. Add your own below, or switch on “This episode has a guest” in the brief and regenerate.
          </p>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {questions.map((question, i) => (
              <li key={i} className="group/point flex items-start gap-2.5">
                <span className="tabular w-5 shrink-0 pt-[0.15rem] text-right font-mono text-sm text-ink-faint">{i + 1}.</span>
                <div className="max-w-measure flex-1 text-base">
                  <EditableText multiline value={question} label={`guest question ${i + 1}`} readOnly={readOnly} placeholder="Write a question" onCommit={(value) => updateGuestQuestion(i, value)} />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeGuestQuestion(i)}
                    aria-label={`Remove guest question ${i + 1}`}
                    className="btn btn-quiet h-6 w-6 px-0 text-base leading-none text-ink-faint opacity-0 focus-visible:opacity-100 group-hover/point:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    &times;
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}

        {!readOnly && (
          <button type="button" onClick={addGuestQuestion} className="link-action mt-2">
            Add a question
          </button>
        )}
      </div>
    </section>
  );
}
