function Shimmer({ className }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-surface-sunken ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-border/60 to-transparent" />
    </div>
  );
}

/** Placeholder shown in the outline column while /api/generate-outline is in flight. */
export function OutlineSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Shimmer className="h-7 w-3/5" />
      <Shimmer className="h-4 w-2/5" />
      <Shimmer className="h-3 w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface-raised p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Shimmer className="h-8 w-8 rounded-full shrink-0" />
            <Shimmer className="h-5 w-2/3" />
          </div>
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
          <Shimmer className="h-3 w-4/6" />
        </div>
      ))}
    </div>
  );
}

export function DeepDiveSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Shimmer className="h-3 w-full" />
      <Shimmer className="h-3 w-11/12" />
      <Shimmer className="h-3 w-full" />
      <Shimmer className="h-3 w-4/6" />
      <Shimmer className="h-3 w-full" />
      <Shimmer className="h-3 w-9/12" />
    </div>
  );
}
