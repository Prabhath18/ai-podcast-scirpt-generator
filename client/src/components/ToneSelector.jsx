import { TONES } from '../hooks/constants.js';

export default function ToneSelector({ value, customValue, onChange, onCustomChange }) {
  const options = [...TONES, 'Other'];

  return (
    <div>
      <div role="radiogroup" aria-label="Tone" className="flex flex-wrap gap-1.5">
        {options.map((tone) => {
          const selected = value === tone;
          return (
            <button
              key={tone}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(tone)}
              className={`rounded border px-2.5 py-1 text-sm transition-colors duration-150 ${
                selected
                  ? 'border-accent bg-accent-tint font-medium text-ink'
                  : 'border-line-strong bg-page text-ink-muted hover:border-ink-faint hover:text-ink'
              }`}
            >
              {tone}
            </button>
          );
        })}
      </div>
      {value === 'Other' && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder='Describe the tone, e.g. "dry and skeptical"'
          maxLength={60}
          className="field mt-2"
          aria-label="Custom tone description"
        />
      )}
    </div>
  );
}
