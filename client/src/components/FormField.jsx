export default function FormField({ id, label, error, hint, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-accent" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The one "pick one" control: a row of choice chips with radio semantics (arrow keys move
 * the choice and skip disabled options). Used for tone-like choices, hosts, structures,
 * and the scope and filter toggles in the side panel. `options` is [{ value, label, disabled? }].
 */
export function Segmented({ label, options, value, onChange, size = 'md' }) {
  const enabled = options.filter((o) => !o.disabled);
  const move = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const at = enabled.findIndex((o) => o.value === value);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    onChange(next.value);
    event.currentTarget.parentElement.querySelector(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={move}
            className={`choice ${size === 'sm' ? 'choice-sm' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
