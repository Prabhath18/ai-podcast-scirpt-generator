// Loading placeholders that reproduce the final layout (same gutter, same
// row rhythm), so the page doesn't jump when the real content arrives.

function Bar({ className }) {
  return <div className={`animate-pulse rounded-sm bg-sunken ${className}`} />;
}

/** Stands in for the outline document while /api/generate-* is in flight. */
export function OutlineSkeleton({ rows = 5 }) {
  return (
    <div aria-hidden="true" data-testid="outline-skeleton">
      <Bar className="mb-3 h-8 w-3/4" />
      <Bar className="mb-8 h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-line py-5 sm:grid-cols-[3.5rem_1fr]">
          <Bar className="h-4 w-6" />
          <div>
            <Bar className="mb-3 h-6 w-2/3" />
            <Bar className="mb-2 h-4 w-full" />
            <Bar className="mb-2 h-4 w-11/12" />
            <Bar className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Stands in for panel content (Deep Dive notes, research results, comments). */
export function PanelSkeleton({ lines = 6 }) {
  return (
    <div aria-hidden="true" className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} className={`h-3.5 ${['w-full', 'w-11/12', 'w-full', 'w-4/6', 'w-full', 'w-9/12'][i % 6]}`} />
      ))}
    </div>
  );
}
