/** A short, plain empty state: a title in the producer's voice, one line of help, and an optional action. */
export default function EmptyState({ title, description, action, className = '' }) {
  return (
    <div className={`border border-dashed border-line-strong px-5 py-8 rounded-md ${className}`}>
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-measure text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
