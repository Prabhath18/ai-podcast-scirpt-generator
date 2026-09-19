import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Accessible modal: traps Escape-to-close, labels itself, and returns focus to its first focusable child on open. */
export default function Modal({ title, onClose, children, maxWidthClass = 'max-w-md' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.querySelector('input, button, textarea, select')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="presentation">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidthClass} rounded-2xl bg-surface-raised shadow-popover border border-border p-6`}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 id="modal-title" className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
