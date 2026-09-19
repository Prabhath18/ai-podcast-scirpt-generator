export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl border border-dashed border-border bg-surface-raised/50">
      {Icon && (
        <div className="w-11 h-11 rounded-full bg-accent-subtle flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-accent" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-muted max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
