/** A small ring spinner. The label is read by screen readers; nothing else announces the wait. */
export default function Spinner({ className = 'h-4 w-4', label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex">
      <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
