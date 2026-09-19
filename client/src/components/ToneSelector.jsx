import { TONES } from '../hooks/constants.js';
import { inputClasses } from './FormField.jsx';

export default function ToneSelector({ value, customValue, onChange, onCustomChange }) {
  const options = [...TONES, 'Other'];

  return (
    <div>
      <div role="radiogroup" aria-label="Tone" className="flex flex-wrap gap-2">
        {options.map((tone) => {
          const selected = value === tone;
          return (
            <button
              key={tone}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(tone)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                selected
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-ink-muted border-border hover:text-ink hover:border-ink-faint'
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
          className={`${inputClasses} mt-2`}
          aria-label="Custom tone description"
        />
      )}
    </div>
  );
}
