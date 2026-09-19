import { OUTLINE_LIMITS } from '../hooks/constants.js';
import { variationSummary } from '../utils/blend.js';
import { segmentTimings } from '../utils/durationMath.js';
import EmptyState from './EmptyState.jsx';

const pad = (n) => String(n).padStart(2, '0');

/** One variation: its shape at a glance, plus per-segment Add / Replace controls for blending. */
function VariationColumn({ variation, index, isCurrent, workingSegments, onUse, onBlend }) {
  const { outline, approach, rationale } = variation;
  const { segmentCount, totalMins } = variationSummary(variation);
  const timings = segmentTimings(outline.segments);
  const atLimit = workingSegments.length >= OUTLINE_LIMITS.MAX_SEGMENTS;

  return (
    <article aria-labelledby={`variation-${index}`} className="flex flex-col border-t-2 border-ink pt-3">
      <p className="label">Structure {index + 1}</p>
      <h3 id={`variation-${index}`} className="mt-0.5 font-serif text-lg font-semibold">{approach}</h3>
      <p className="mt-1 text-sm text-ink-muted">{rationale}</p>
      <p className="tabular mt-3 font-mono text-xs text-ink-muted">
        {segmentCount} segments · {totalMins} min
      </p>
      <p className="mt-1 font-serif text-base font-medium">{outline.episode_title}</p>
      <button type="button" className="btn btn-primary mt-3 self-start" onClick={onUse} disabled={isCurrent}>
        {isCurrent ? 'Current outline' : 'Use this outline'}
      </button>

      <ol className="mt-4 divide-y divide-line border-y border-line">
        {outline.segments.map((segment, i) => (
          <li key={segment.id} className="py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="tabular w-5 shrink-0 font-mono text-xs text-ink-faint">{pad(i + 1)}</span>
              <p className="min-w-0 flex-1 text-sm font-medium">{segment.title}</p>
              <span className="tabular shrink-0 font-mono text-xs text-ink-faint">{timings[i].start}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-7">
              <button
                type="button"
                className="link-action"
                disabled={atLimit}
                title={atLimit ? `Your outline is at the ${OUTLINE_LIMITS.MAX_SEGMENTS}-segment limit. Replace one instead.` : undefined}
                aria-label={`Add “${segment.title}” to your outline`}
                onClick={() => onBlend(segment.id, 'add')}
              >
                Add
              </button>
              <select
                aria-label={`Replace one of your segments with “${segment.title}”`}
                value=""
                onChange={(event) => event.target.value && onBlend(segment.id, 'replace', Number(event.target.value))}
                className="max-w-[10rem] cursor-pointer rounded-sm border border-line-strong bg-page py-0.5 pl-1.5 pr-1 text-xs text-ink-muted hover:border-ink-faint"
              >
                <option value="">Replace…</option>
                {workingSegments.map((working, wi) => (
                  <option key={working.id} value={working.id}>
                    {pad(wi + 1)} {working.title}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

/**
 * Side-by-side comparison of the outlines generated from one brief (stacked
 * on phones). Pick one as the working outline, or borrow single segments from
 * any of them; the timeline above updates live.
 */
export default function VariationsView({ workspace, onEditBrief }) {
  const { outline, totalDurationLive, chooseVariation, blendSegment, discardVariations } = workspace;
  const variations = outline.variations || [];

  if (variations.length === 0) {
    return (
      <EmptyState
        title="No alternatives yet"
        description="Set “Structures” to 2 or 3 in the brief and generate again. One request returns outlines with different shapes to compare here."
        action={<button type="button" className="btn" onClick={onEditBrief}>Edit the brief</button>}
      />
    );
  }

  const isCurrent = (variation) => variation.outline.episode_title === outline.episode_title && JSON.stringify(variation.outline.segments.map((s) => s.title)) === JSON.stringify(outline.segments.map((s) => s.title));

  return (
    <div>
      <div className="max-w-measure">
        <h2 className="font-serif text-xl font-semibold">Compare structures</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Same brief, different shapes. Use one as your working outline, or add or replace single segments; your runtime stays at{' '}
          <span className="tabular font-mono text-ink">{totalDurationLive} min</span>.
        </p>
      </div>

      <div className={`mt-6 grid grid-cols-1 gap-x-6 gap-y-10 ${variations.length === 3 ? 'xl:grid-cols-3' : ''} ${variations.length >= 2 ? 'md:grid-cols-2' : ''}`}>
        {variations.map((variation, index) => (
          <VariationColumn
            key={index}
            variation={variation}
            index={index}
            isCurrent={isCurrent(variation)}
            workingSegments={outline.segments}
            onUse={() => chooseVariation(index, variation.approach)}
            onBlend={(segmentId, mode, targetId) => blendSegment(index, segmentId, mode, targetId, variation.approach)}
          />
        ))}
      </div>

      <p className="mt-8 border-t border-line pt-4 text-sm text-ink-muted">
        Done comparing?{' '}
        <button type="button" className="link-action" onClick={discardVariations}>
          Discard the alternatives
        </button>{' '}
        (you can undo it).
      </p>
    </div>
  );
}
