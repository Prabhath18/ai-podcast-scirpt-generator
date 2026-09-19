/** The mark is three rows of different lengths: an outline, and also segments of an episode. */
export function Mark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="6" className="fill-accent" />
      <rect x="7" y="7" width="18" height="4" rx="1" className="fill-accent-fg" />
      <rect x="7" y="14" width="11" height="4" rx="1" className="fill-accent-fg" />
      <rect x="7" y="21" width="15" height="4" rx="1" className="fill-accent-fg" />
    </svg>
  );
}

export default function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark />
      <span className="translate-y-[1px] font-serif text-[1.0625rem] font-semibold leading-none tracking-tight">
        Podcast Outline <span className="text-accent">AI</span>
      </span>
    </span>
  );
}
