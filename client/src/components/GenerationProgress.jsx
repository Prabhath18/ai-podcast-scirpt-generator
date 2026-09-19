import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { OutlineSkeleton } from './Skeletons.jsx';

export const GENERATION_STEPS = [
  'Analysing podcast strategy',
  'Structuring narrative flow',
  'Drafting guest questions',
  'Synthesising outline',
];

const STEP_MS = 3500;

/**
 * Shown while an outline is being generated. The API is one request and reports no
 * stages, so the steps advance on a timer and the bar is an estimate that levels off
 * below 100% until the real response arrives (this component is then unmounted).
 * It changes nothing about how generation works.
 */
export default function GenerationProgress({ structures = 0 }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(timer);
  }, []);

  const active = Math.min(Math.floor(elapsed / STEP_MS), GENERATION_STEPS.length - 1);
  const percent = Math.round(92 * (1 - Math.exp(-elapsed / 9000)));

  return (
    <section aria-labelledby="generation-title" aria-busy="true" className="mt-6">
      <div className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="generation-title" className="font-serif text-xl font-semibold">Generating Outline</h2>
          <span className="tabular font-mono text-xs text-ink-muted" aria-hidden="true">{percent}%</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {structures >= 2 ? `Comparing ${structures} structures. ` : ''}This usually takes 10 to 20 seconds.
        </p>

        <div
          role="progressbar"
          aria-label="Generation progress (estimated)"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunken"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </div>

        <ol className="mt-5 space-y-2.5">
          {GENERATION_STEPS.map((label, index) => {
            const state = index < active ? 'done' : index === active ? 'active' : 'pending';
            return (
              <li key={label} aria-current={state === 'active' ? 'step' : undefined} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    state === 'done'
                      ? 'border-accent bg-accent text-accent-fg'
                      : state === 'active'
                        ? 'border-accent text-accent'
                        : 'border-line-strong text-transparent'
                  }`}
                >
                  {state === 'done' && <Check className="h-3 w-3" strokeWidth={3} />}
                  {state === 'active' && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
                </span>
                <span className={state === 'pending' ? 'text-ink-faint' : state === 'active' ? 'font-medium text-ink' : 'text-ink-muted'}>
                  {label}
                  <span className="sr-only">{state === 'done' ? ', done' : state === 'active' ? ', in progress' : ', waiting'}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <p className="sr-only" role="status">
          Step {active + 1} of {GENERATION_STEPS.length}: {GENERATION_STEPS[active]}
        </p>
      </div>

      <div className="mt-8" aria-hidden="true">
        <p className="label mb-4">Preview of your outline</p>
        <OutlineSkeleton />
      </div>
    </section>
  );
}
