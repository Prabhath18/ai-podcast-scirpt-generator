import { useEffect, useRef } from 'react';

/**
 * Inline error for a failed generation, shown on the New Episode screen right under the
 * form (not a page, not a toast). It takes focus so keyboard and screen-reader users
 * land on it, and offers the two ways forward: try again, or go change the settings.
 * `extra` is an optional third action for cases with a specific fix (e.g. open a demo).
 */
export default function GenerationError({ title, message, onRetry, onBack, extra }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  return (
    <div ref={ref} role="alert" tabIndex={-1} className="callout callout-danger mt-6 p-4 outline-none sm:p-5">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-measure text-sm text-ink">{message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={onRetry}>Retry Generation</button>
        <button type="button" className="btn" onClick={onBack}>Back to Edit Settings</button>
        {extra}
      </div>
    </div>
  );
}
