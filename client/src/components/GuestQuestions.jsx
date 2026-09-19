import { Plus, Trash2, RefreshCw, Users } from 'lucide-react';
import { inputClasses } from './FormField.jsx';
import Spinner from './Spinner.jsx';
import { useAsyncCallback } from '../hooks/useAsyncCallback.js';
import { useToast } from '../hooks/useToast.jsx';
import { api, ApiError } from '../services/api.js';

export default function GuestQuestions({ workspace, isReadOnly }) {
  const { form, outline, updateGuestQuestion, addGuestQuestion, removeGuestQuestion, setGuestQuestions } = workspace;
  const toast = useToast();

  const regenerate = async () => {
    const result = await api.post('/api/guest-questions', {
      topic: form.topic.trim() || outline.episode_title,
      tone: form.tone === 'Other' ? form.customTone : form.tone,
      lengthMins: Number(form.lengthMins),
      guestNames: form.guestNames.trim(),
      guestBio: form.guestBio.trim(),
      outline,
    });
    setGuestQuestions(result.questions);
  };
  const { run: runRegenerate, loading } = useAsyncCallback(regenerate);

  const handleRegenerate = async () => {
    try {
      await runRegenerate();
      toast.success('Guest questions refreshed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not regenerate guest questions.');
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface-raised shadow-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          <Users className="w-4 h-4 text-accent" aria-hidden="true" />
          Guest Questions
        </h2>
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-50 transition-colors"
          >
            {loading ? <Spinner className="w-3.5 h-3.5" label="Regenerating" /> : <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
            Regenerate
          </button>
        )}
      </div>

      {outline.guest_questions.length === 0 ? (
        <p className="text-sm text-ink-muted mb-3">
          {isReadOnly ? 'No guest questions for this episode.' : 'No guest questions yet. Add one below, or turn on “Include a guest interview” and regenerate the outline.'}
        </p>
      ) : isReadOnly ? (
        <ol className="space-y-2 mb-1 list-decimal list-inside text-sm text-ink">
          {outline.guest_questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      ) : (
        <ol className="space-y-2 mb-3 list-decimal list-inside">
          {outline.guest_questions.map((q, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => updateGuestQuestion(i, e.target.value)}
                aria-label={`Guest question ${i + 1}`}
                className={`${inputClasses} py-1.5`}
              />
              <button
                type="button"
                onClick={() => removeGuestQuestion(i)}
                aria-label={`Remove guest question ${i + 1}`}
                className="p-1.5 rounded-md text-ink-faint hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {!isReadOnly && (
        <button
          type="button"
          onClick={addGuestQuestion}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Add question
        </button>
      )}
    </section>
  );
}
