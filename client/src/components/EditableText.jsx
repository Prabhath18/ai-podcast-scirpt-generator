import { useEffect, useRef, useState } from 'react';

/**
 * Text that reads like a document until you click it, then becomes a field.
 *   click or Enter/Space on the text  start editing
 *   Enter                             save (single line)
 *   Cmd/Ctrl+Enter                    save (multiline; plain Enter adds a line)
 *   Escape                            discard the change
 *   leaving the field                 save
 * `numeric` fields accept whole minutes only and revert on anything else.
 * A `required` field reverts instead of saving an empty value.
 */
export default function EditableText({
  value,
  onCommit,
  label,
  multiline = false,
  numeric = false,
  required = false,
  readOnly = false,
  placeholder = 'Add text',
  className = '',
  inputClassName = '',
  suffix = '',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const fieldRef = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const el = fieldRef.current;
    el.focus();
    if (!multiline) el.select();
  }, [editing, multiline]);

  // Grow the textarea with its content so nothing scrolls inside a field.
  useEffect(() => {
    const el = fieldRef.current;
    if (editing && multiline && el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing, multiline, draft]);

  if (readOnly) {
    return <span className={`block whitespace-pre-wrap ${className}`}>{value}{suffix}</span>;
  }

  const start = () => {
    cancelled.current = false;
    setDraft(String(value ?? ''));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (cancelled.current) return;
    const next = draft.trim();
    if (numeric) {
      const minutes = Number(next);
      if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 180 && minutes !== Number(value)) onCommit(Math.round(minutes));
      return;
    }
    if (required && !next) return;
    if (next !== String(value ?? '').trim()) onCommit(next);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancelled.current = true;
      setEditing(false);
    } else if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      fieldRef.current.blur();
    }
  };

  if (editing) {
    const shared = {
      ref: fieldRef,
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onKeyDown,
      onBlur: commit,
      'aria-label': label,
      className: `field ${className} ${inputClassName}`,
    };
    return multiline ? <textarea rows={2} {...shared} className={`${shared.className} resize-none`} /> : <input type="text" inputMode={numeric ? 'numeric' : undefined} {...shared} />;
  }

  const isEmpty = !String(value ?? '').trim();
  return (
    <button
      type="button"
      onClick={start}
      aria-label={`Edit ${label}`}
      className={`editable ${multiline ? 'whitespace-pre-wrap' : ''} ${className}`}
    >
      {isEmpty ? <span className="text-ink-faint">{placeholder}</span> : <>{value}{suffix}</>}
    </button>
  );
}
