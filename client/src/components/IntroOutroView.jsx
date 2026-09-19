import EditableText from './EditableText.jsx';
import EmptyState from './EmptyState.jsx';
import Spinner from './Spinner.jsx';
import { useAsyncCallback } from '../hooks/useAsyncCallback.js';
import { useToast } from '../hooks/useToast.jsx';
import { api, ApiError } from '../services/api.js';

const HOST_HINT = {
  solo: 'One voice. Your scripts read as a single host.',
  duo: 'Two hosts. Scripts mark each turn as Host 1 or Host 2.',
  group: 'A group. Scripts mark each turn as Host 1, Host 2 or Host 3.',
};

function SectionHead({ title, note }) {
  return (
    <div className="mb-2 border-t border-line pt-5">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-sm text-ink-muted">{note}</p>}
    </div>
  );
}

/** Hooks, the full intro script, outros and a teaser, generated in one call and editable in place. */
export default function IntroOutroView({ workspace }) {
  const { outline, form, resolvedTone, updateIntroOutro, updateHook, updateOutroOption, withUndo } = workspace;
  const toast = useToast();
  const data = outline.intro_outro;

  const generate = async () => {
    const result = await api.post('/api/intro-outro', {
      topic: form.topic.trim() || outline.episode_title,
      tone: resolvedTone || outline.tone,
      hostCount: form.hostCount,
      podcastName: form.podcastName.trim() || undefined,
      lengthMins: Number(form.lengthMins) || outline.total_duration_mins,
      outline,
    });
    return result.introOutro;
  };
  const { run: runGenerate, loading } = useAsyncCallback(generate);

  const handleGenerate = async () => {
    try {
      const next = await runGenerate();
      // Regenerating replaces any edits, so it goes through Undo like a delete does.
      withUndo(data ? 'Hooks and outros regenerated.' : 'Hooks, intro and outros are ready.', { type: 'SET_INTRO_OUTRO', data: next });
    } catch (err) {
      const message =
        err instanceof ApiError && err.code === 'LLM_NOT_CONFIGURED'
          ? 'The server has no Gemini API key, so it cannot write these. The demo outlines include a sample set.'
          : err instanceof ApiError
            ? err.message
            : 'Could not generate the intro and outro.';
      toast.error(message, { action: { label: 'Try again', onClick: handleGenerate } });
    }
  };

  if (!data) {
    return (
      <EmptyState
        title="Open strong, close cleanly"
        description={`Five opening hooks (question, bold claim, story, statistic, cold open), a full intro script, three outros with a call to action, and a teaser line, from one request. ${HOST_HINT[form.hostCount]}`}
        action={
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading && <Spinner className="h-3.5 w-3.5" label="Generating" />}
            {loading ? 'Writing…' : 'Write intro and outro'}
          </button>
        }
      />
    );
  }

  const inUseHook = (hook) => hook.text.trim() && outline.intro.trim().startsWith(hook.text.trim());
  const inUseOutro = (text) => text.trim() && outline.outro.trim() === text.trim();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-measure">
          <h2 className="font-serif text-xl font-semibold">Intro and outro</h2>
          <p className="mt-1 text-sm text-ink-muted">{HOST_HINT[form.hostCount]} Edit any line, then choose the ones to use. Your choices go straight into the outline and the exported script.</p>
        </div>
        <button type="button" className="btn" onClick={handleGenerate} disabled={loading}>
          {loading && <Spinner className="h-3.5 w-3.5" label="Regenerating" />}
          {loading ? 'Writing…' : 'Regenerate all'}
        </button>
      </div>

      <div className="mt-6">
        <SectionHead title="Opening hooks" note="A hook opens the intro; the intro script below follows it." />
        <ul className="divide-y divide-line">
          {data.hooks.map((hook, index) => (
            <li key={hook.style} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 sm:grid-cols-[6.5rem_1fr_auto]">
              <p className="label pt-1">{hook.style}</p>
              <div className="max-w-measure font-serif text-prose">
                <EditableText multiline value={hook.text} label={`${hook.style} hook`} placeholder="Write a hook" onCommit={(text) => updateHook(index, text)} />
              </div>
              {inUseHook(hook) ? (
                <p className="self-start pt-1 font-mono text-2xs uppercase text-ok">In use</p>
              ) : (
                <button type="button" className="link-action self-start pt-1" aria-label={`Use the ${hook.style} hook`} onClick={() => withUndo(`${hook.style} hook is now your intro.`, { type: 'USE_HOOK', index })}>
                  Use this
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <SectionHead title="Intro script" note={form.hostCount === 'solo' ? 'Read as one voice.' : 'Speaker turns are labelled.'} />
        <div className="max-w-measure whitespace-pre-wrap font-serif text-prose">
          <EditableText multiline value={data.intro_script} label="intro script" placeholder="Write the intro script" onCommit={(intro_script) => updateIntroOutro({ intro_script })} />
        </div>
      </div>

      <div className="mt-6">
        <SectionHead title="Outros" note="Each ends with a call to action." />
        <ul className="divide-y divide-line">
          {data.outros.map((text, index) => (
            <li key={index} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 sm:grid-cols-[6.5rem_1fr_auto]">
              <p className="label pt-1">Option {index + 1}</p>
              <div className="max-w-measure font-serif text-prose">
                <EditableText multiline value={text} label={`outro option ${index + 1}`} placeholder="Write an outro" onCommit={(value) => updateOutroOption(index, value)} />
              </div>
              {inUseOutro(text) ? (
                <p className="self-start pt-1 font-mono text-2xs uppercase text-ok">In use</p>
              ) : (
                <button type="button" className="link-action self-start pt-1" aria-label={`Use outro option ${index + 1}`} onClick={() => withUndo(`Outro option ${index + 1} is now your outro.`, { type: 'USE_OUTRO', index })}>
                  Use this
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <SectionHead title="Episode teaser" note="One line for the feed, an email or a post." />
        <div className="max-w-measure font-serif text-prose italic">
          <EditableText value={data.teaser} label="episode teaser" placeholder="Write a teaser" onCommit={(teaser) => updateIntroOutro({ teaser })} />
        </div>
      </div>
    </div>
  );
}
