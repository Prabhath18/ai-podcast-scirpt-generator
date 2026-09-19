import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import ToneSelector from './ToneSelector.jsx';
import FormField, { inputClasses } from './FormField.jsx';
import Spinner from './Spinner.jsx';
import { HOST_COUNTS } from '../hooks/constants.js';
import { demoOutlines } from '../services/demoData.js';
import { useAsyncCallback } from '../hooks/useAsyncCallback.js';
import { useToast } from '../hooks/useToast.jsx';
import { ApiError } from '../services/api.js';

export default function TopicForm({ workspace, collapsedByDefault, onGeneratingChange }) {
  const { form, setFormField, generate, loadDemo } = workspace;
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [errors, setErrors] = useState({});
  const toast = useToast();
  const { run: runGenerate, loading } = useAsyncCallback(generate);

  const validate = () => {
    const next = {};
    if (!form.topic.trim()) next.topic = 'Topic is required.';
    else if (form.topic.trim().length > 300) next.topic = 'Keep it under 300 characters.';

    if (form.tone === 'Other' && !form.customTone.trim()) next.customTone = 'Describe the custom tone, or pick one above.';

    const length = Number(form.lengthMins);
    if (!Number.isFinite(length) || length < 5 || length > 180) next.lengthMins = 'Choose a length between 5 and 180 minutes.';

    if (form.includeGuests && !form.guestNames.trim()) next.guestNames = "Add the guest's name, or turn guests off.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    onGeneratingChange?.(true);
    try {
      await runGenerate();
      setCollapsed(true);
      toast.success('Episode outline generated.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LLM_NOT_CONFIGURED') {
        toast.error('No Gemini API key is configured on the server. Try a demo below instead, or add GEMINI_API_KEY to server/.env.');
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        toast.error(err.details?.[0]?.message || 'Please check the form and try again.');
      } else if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Something went wrong generating the outline.');
      }
    } finally {
      onGeneratingChange?.(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface-raised shadow-card">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 font-semibold text-ink">
          <Sparkles className="w-4 h-4 text-accent" aria-hidden="true" />
          Episode details
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-ink-muted" /> : <ChevronUp className="w-4 h-4 text-ink-muted" />}
      </button>

      {!collapsed && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-5" noValidate>
          <FormField id="topic" label="Podcast topic" required error={errors.topic}>
            <textarea
              id="topic"
              value={form.topic}
              onChange={(e) => setFormField('topic', e.target.value)}
              placeholder='e.g. "The rise of AI in education"'
              rows={2}
              maxLength={300}
              className={`${inputClasses} resize-none`}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="podcastName" label="Podcast name" hint="Optional">
              <input
                id="podcastName"
                type="text"
                value={form.podcastName}
                onChange={(e) => setFormField('podcastName', e.target.value)}
                placeholder="e.g. The Weekly Signal"
                maxLength={100}
                className={inputClasses}
              />
            </FormField>

            <FormField id="lengthMins" label="Target length (minutes)" required error={errors.lengthMins}>
              <input
                id="lengthMins"
                type="number"
                min={5}
                max={180}
                value={form.lengthMins}
                onChange={(e) => setFormField('lengthMins', e.target.value)}
                className={inputClasses}
                aria-invalid={Boolean(errors.lengthMins)}
              />
            </FormField>
          </div>

          <FormField id="hostCount" label="Hosts">
            <div role="radiogroup" aria-label="Host count" className="inline-flex rounded-lg border border-border p-1 bg-surface-sunken">
              {HOST_COUNTS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.hostCount === value}
                  onClick={() => setFormField('hostCount', value)}
                  className={`px-3.5 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    form.hostCount === value ? 'bg-surface-raised text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </FormField>

          <div className="rounded-xl border border-border p-4 bg-surface-sunken/60">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.includeGuests}
                onChange={(e) => setFormField('includeGuests', e.target.checked)}
                className="w-4 h-4 rounded accent-accent"
              />
              <span className="text-sm font-medium text-ink">Include a guest interview</span>
            </label>

            {form.includeGuests && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="guestNames" label="Guest name(s)" required error={errors.guestNames}>
                  <input
                    id="guestNames"
                    type="text"
                    value={form.guestNames}
                    onChange={(e) => setFormField('guestNames', e.target.value)}
                    placeholder="e.g. Dr. Amara Okafor"
                    maxLength={200}
                    className={inputClasses}
                  />
                </FormField>
                <FormField id="guestBio" label="Guest bio" hint="A sentence or two of background">
                  <input
                    id="guestBio"
                    type="text"
                    value={form.guestBio}
                    onChange={(e) => setFormField('guestBio', e.target.value)}
                    placeholder="e.g. AI researcher focused on classroom tools"
                    maxLength={1000}
                    className={inputClasses}
                  />
                </FormField>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 transition-colors"
          >
            {loading ? <Spinner className="w-4 h-4 text-white" label="Generating outline" /> : <Wand2 className="w-4 h-4" aria-hidden="true" />}
            {loading ? 'Generating outline…' : 'Generate outline'}
          </button>

          <div className="pt-1 border-t border-border">
            <p className="text-xs font-medium text-ink-faint uppercase tracking-wide mt-4 mb-2">Or try a demo -- no API key needed</p>
            <div className="flex flex-wrap gap-2">
              {demoOutlines.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => {
                    loadDemo(demo.id);
                    setCollapsed(true);
                  }}
                  className="text-sm rounded-lg border border-border px-3 py-1.5 text-ink-muted hover:text-ink hover:border-ink-faint transition-colors"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
