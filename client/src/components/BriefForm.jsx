import { useEffect, useRef, useState } from 'react';
import ToneSelector from './ToneSelector.jsx';
import FormField, { Segmented } from './FormField.jsx';
import Spinner from './Spinner.jsx';
import GenerationError from './GenerationError.jsx';
import { HOST_COUNTS } from '../hooks/constants.js';
import { demoOutlines } from '../services/demoData.js';
import { useAsyncCallback } from '../hooks/useAsyncCallback.js';
import { useToast } from '../hooks/useToast.jsx';
import { ApiError } from '../services/api.js';

const STRUCTURE_OPTIONS = [
  { value: 0, label: 'One outline' },
  { value: 2, label: '2 structures' },
  { value: 3, label: '3 structures' },
];

const HOST_LABEL = { solo: 'Solo', duo: 'Duo', group: 'Group' };

/**
 * The episode brief. Before an outline exists it is the whole page; after,
 * it folds into a one-line summary you can reopen (or reach with "/").
 */
export default function BriefForm({ workspace, hasOutline, onGeneratingChange, onGenerated, focusSignal }) {
  const { form, resolvedTone, setFormField, generate, loadDemo } = workspace;
  const [collapsed, setCollapsed] = useState(hasOutline);
  const [errors, setErrors] = useState({});
  const [genError, setGenError] = useState(null);
  const topicRef = useRef(null);
  const toast = useToast();
  const { run: runGenerate, loading } = useAsyncCallback(generate);

  const wantsFocus = useRef(false);
  useEffect(() => {
    if (!focusSignal) return;
    wantsFocus.current = true;
    setCollapsed(false);
  }, [focusSignal]);
  // Runs after the form is on screen: immediately if it was open, one render later if it was folded.
  useEffect(() => {
    if (!collapsed && wantsFocus.current) {
      wantsFocus.current = false;
      topicRef.current?.focus();
    }
  }, [collapsed, focusSignal]);

  const validate = () => {
    const next = {};
    if (!form.topic.trim()) next.topic = 'Add a topic so there is something to outline.';
    else if (form.topic.trim().length > 300) next.topic = 'Keep the topic under 300 characters.';
    if (form.tone === 'Other' && !form.customTone.trim()) next.customTone = 'Describe the tone, or pick one above.';
    const length = Number(form.lengthMins);
    if (!Number.isFinite(length) || length < 5 || length > 180) next.lengthMins = 'Choose a length between 5 and 180 minutes.';
    if (form.includeGuests && !form.guestNames.trim()) next.guestNames = "Add the guest's name, or turn the guest off.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Turns a failed generation into the wording for the inline error card.
  const describeError = (err) => {
    const code = err instanceof ApiError ? err.code : null;
    if (code === 'LLM_NOT_CONFIGURED') {
      return {
        title: "Generation isn't set up yet",
        message: "The server has no Gemini API key, so it can't write outlines. Add GEMINI_API_KEY to server/.env, or explore with a demo.",
        withDemo: true,
      };
    }
    if (code === 'VALIDATION_ERROR') {
      return { title: 'Check the brief', message: err.details?.[0]?.message || 'Something in the brief was not accepted. Adjust it and try again.' };
    }
    if (code === 'RATE_LIMITED') {
      return { title: 'Too many requests', message: 'That was a lot of requests in a short time. Wait a minute, then retry.' };
    }
    if (code === 'LLM_INVALID_RESPONSE') {
      return { title: "The outline didn't pass checks", message: "The model's answer failed validation, even after an automatic retry. Retrying usually works; a narrower topic can help." };
    }
    if (code === 'LLM_TIMEOUT') {
      return { title: 'The model took too long', message: `${err.message} Retrying often works once the model is warm.` };
    }
    if (code === 'LLM_RATE_LIMITED') {
      return { title: "The AI provider's limit was reached", message: err.message };
    }
    if (code === 'LLM_AUTH' || code === 'LLM_PROVIDER_ERROR') {
      return { title: 'The AI provider had a problem', message: err.message };
    }
    if (code === 'NETWORK_ERROR') {
      return { title: "Can't reach the server", message: 'Check your connection and that the API is running, then retry.' };
    }
    return { title: 'Generation failed', message: err instanceof ApiError ? err.message : 'Something went wrong while generating the outline.' };
  };

  const backToSettings = () => {
    setGenError(null);
    setCollapsed(false);
    requestAnimationFrame(() => {
      topicRef.current?.focus();
      topicRef.current?.scrollIntoView?.({ block: 'center' });
    });
  };

  const submit = async () => {
    if (!validate()) return;
    setGenError(null);
    onGeneratingChange?.(true);
    try {
      const requested = Number(form.variationCount);
      const result = await runGenerate();
      setCollapsed(true);
      if (requested >= 2) {
        if (result.skipped > 0) {
          toast.warn(`Showing ${result.variations} of ${requested} structures. ${result.skipped} didn't pass validation after a retry and was left out.`);
        } else {
          toast.success(`${result.variations} structures ready to compare.`);
        }
      } else {
        toast.success('Outline ready. Everything is editable.');
      }
      onGenerated?.(result);
    } catch (err) {
      setGenError(describeError(err));
    } finally {
      onGeneratingChange?.(false);
    }
  };

  if (hasOutline && collapsed) {
    return (
      <div className="flex items-center gap-3 border-b border-line py-3">
        <p className="label shrink-0">Brief</p>
        <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
          {form.topic} · {resolvedTone} · {form.lengthMins} min · {HOST_LABEL[form.hostCount]}
        </p>
        <button type="button" className="link-action shrink-0" onClick={() => setCollapsed(false)} aria-expanded="false">
          Edit brief
        </button>
      </div>
    );
  }

  const count = Number(form.variationCount);

  return (
    <section aria-labelledby="brief-heading" className={hasOutline ? 'border-b border-line pb-6' : 'pb-6'}>
      {hasOutline ? (
        <div className="mb-4 flex items-center justify-between">
          <h2 id="brief-heading" className="label">Brief</h2>
          <button type="button" className="link-action" onClick={() => setCollapsed(true)} aria-expanded="true">
            Fold away
          </button>
        </div>
      ) : (
        <div className="mb-6">
          <h1 id="brief-heading" className="font-serif text-xl font-semibold sm:text-2xl">
            Start with the brief
          </h1>
          <p className="mt-1.5 max-w-measure text-prose text-ink-muted">
            Tell us the episode. You get a timed outline you can edit like a script, compare structures, research and export.
          </p>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-5"
        noValidate
      >
        <FormField id="topic" label="Topic" required error={errors.topic}>
          <textarea
            id="topic"
            ref={topicRef}
            value={form.topic}
            onChange={(e) => setFormField('topic', e.target.value)}
            placeholder='e.g. "The rise of AI in education"'
            rows={2}
            maxLength={300}
            className="field resize-none text-base"
            aria-invalid={Boolean(errors.topic)}
          />
        </FormField>

        <FormField id="tone" label="Tone" error={errors.customTone}>
          <ToneSelector
            value={form.tone}
            customValue={form.customTone}
            onChange={(tone) => setFormField('tone', tone)}
            onCustomChange={(v) => setFormField('customTone', v)}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField id="podcastName" label="Podcast name" hint="Optional. Used in the script header.">
            <input id="podcastName" type="text" value={form.podcastName} onChange={(e) => setFormField('podcastName', e.target.value)} placeholder="e.g. The Weekly Signal" maxLength={100} className="field" />
          </FormField>
          <FormField id="lengthMins" label="Length, in minutes" required error={errors.lengthMins}>
            <input id="lengthMins" type="number" min={5} max={180} value={form.lengthMins} onChange={(e) => setFormField('lengthMins', e.target.value)} className="field tabular font-mono" aria-invalid={Boolean(errors.lengthMins)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField id="hostCount" label="Hosts" hint="Solo scripts read as one voice; duo and group mark each speaker.">
            <Segmented label="Host count" options={HOST_COUNTS} value={form.hostCount} onChange={(v) => setFormField('hostCount', v)} />
          </FormField>
          <FormField id="variationCount" label="Structures" hint="Two or three outlines with different shapes, from one request.">
            <Segmented label="Number of structures" options={STRUCTURE_OPTIONS} value={count} onChange={(v) => setFormField('variationCount', v)} />
          </FormField>
        </div>

        <fieldset className="rounded-md border border-line p-4">
          <legend className="sr-only">Guest</legend>
          <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" checked={form.includeGuests} onChange={(e) => setFormField('includeGuests', e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            This episode has a guest
          </label>
          {form.includeGuests && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="guestNames" label="Guest name" required error={errors.guestNames}>
                <input id="guestNames" type="text" value={form.guestNames} onChange={(e) => setFormField('guestNames', e.target.value)} placeholder="e.g. Dr. Amara Okafor" maxLength={200} className="field" aria-invalid={Boolean(errors.guestNames)} />
              </FormField>
              <FormField id="guestBio" label="Guest background" hint="A sentence or two so the questions fit them.">
                <input id="guestBio" type="text" value={form.guestBio} onChange={(e) => setFormField('guestBio', e.target.value)} placeholder="e.g. AI researcher focused on classroom tools" maxLength={1000} className="field" />
              </FormField>
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="submit" disabled={loading} className="btn btn-primary h-9 px-4">
            {loading && <Spinner className="h-3.5 w-3.5" label="Generating" />}
            {loading ? 'Working…' : count >= 2 ? `Generate ${count} structures` : hasOutline ? 'Regenerate outline' : 'Generate outline'}
          </button>
          <p className="text-sm text-ink-muted">
            No API key?{' '}
            <span className="inline-flex flex-wrap gap-x-3">
              {demoOutlines.map((demo) => (
                <button key={demo.id} type="button" className="link-action" onClick={() => { loadDemo(demo.id); setCollapsed(true); onGenerated?.({ variations: 0 }); }}>
                  {demo.label}
                </button>
              ))}
            </span>
          </p>
        </div>
      </form>

      {genError && (
        <GenerationError
          title={genError.title}
          message={genError.message}
          onRetry={submit}
          onBack={backToSettings}
          extra={
            genError.withDemo && (
              <button type="button" className="link-action" onClick={() => { setGenError(null); loadDemo(demoOutlines[0].id); setCollapsed(true); onGenerated?.({ variations: 0 }); }}>
                Open a demo
              </button>
            )
          }
        />
      )}
    </section>
  );
}
