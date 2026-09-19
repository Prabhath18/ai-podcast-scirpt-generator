import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { OutlineSkeleton } from './Skeletons.jsx';

export const GENERATION_STEPS = [
  'Analysing podcast strategy',
  'Structuring narrative flow',
  'Drafting guest questions',
  'Synthesising outline',
];

const STEP_MS = 3500;

// Which of the four steps each real stage of the streamed outline belongs to.
const STEP_FOR_STAGE = { starting: 0, title: 1, intro: 1, segments: 1, questions: 2, outro: 3 };

/** One plain sentence about what the model has just written, from the numbers the server counted. */
function describeStage({ stage, segmentsDrafted, segmentsExpected }) {
  switch (stage) {
    case 'title':
      return 'Titling the episode.';
    case 'intro':
      return 'Writing the intro.';
    case 'segments':
      return segmentsDrafted > 0 ? `${segmentsDrafted} of about ${segmentsExpected} segments drafted.` : 'Drafting the first segment.';
    case 'questions':
      return 'Writing guest questions.';
    case 'outro':
      return 'Writing the outro.';
    case 'retrying':
      return "The first draft didn't pass checks. Writing it again.";
    default:
      return 'Waiting for the model to start writing.';
  }
}

/**
 * Shown while an outline is being generated.
 *
 * With `progress` (from the streaming request: what the model has actually written so far), the bar,
 * the current step and the sentence under it follow the real output. Without it (variations, a browser or
 * server that cannot stream, or a stream that fell back to the plain request) the API reports no stages,
 * so the steps advance on a timer and the bar is an estimate that levels off below 100% until the real
 * response arrives (this component is then unmounted). Either way it changes nothing about how generation works.
 */
export default function GenerationProgress({ structures = 0, progress = null }) {
  const [elapsed, setElapsed] = useState(0);
  const furthestStep = useRef(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(timer);
  }, []);

  const live = progress !== null;
  let active;
  if (live) {
    // A step never goes backwards while writing; a retry (stage "retrying") starts over from the top.
    furthestStep.current = progress.stage === 'retrying' ? 0 : Math.max(furthestStep.current, STEP_FOR_STAGE[progress.stage] ?? 0);
    active = furthestStep.current;
  } else {
    active = Math.min(Math.floor(elapsed / STEP_MS), GENERATION_STEPS.length - 1);
  }
  const percent = live ? Math.round(progress.fraction * 100) : Math.round(92 * (1 - Math.exp(-elapsed / 9000)));

  return (
    <section aria-labelledby="generation-title" aria-busy="true" className="mt-6">
      <div className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="generation-title" className="font-serif text-xl font-semibold">Generating Outline</h2>
          <span className="tabular font-mono text-xs text-ink-muted" aria-hidden="true">{percent}%</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {structures >= 2 ? `Comparing ${structures} structures. ` : ''}
          {live ? 'Progress follows what the model has written so far.' : 'This usually takes 10 to 20 seconds.'}
        </p>

        <div
          role="progressbar"
          aria-label={live ? 'Generation progress' : 'Generation progress (estimated)'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunken"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </div>

        {live && (
          <p className="mt-3 text-sm text-ink-muted" data-testid="generation-detail">
            {describeStage(progress)}
          </p>
        )}

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
          {live ? `. ${describeStage(progress)}` : ''}
        </p>
      </div>

      <div className="mt-8" aria-hidden="true">
        <p className="label mb-4">Preview of your outline</p>
        <OutlineSkeleton />
      </div>
    </section>
  );
}
