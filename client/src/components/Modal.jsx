import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Focus-managed layer shared by dialogs and the mobile side sheet:
 * moves focus inside on open, keeps Tab within it, closes on Escape or a
 * click outside, and hands focus back to whatever opened it.
 */
export function useFocusLayer(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Read during the first render: child effects (like a panel focusing its own
  // tab) run before this hook's effect and would otherwise hide the real opener.
  const [opener] = useState(() => document.activeElement);

  useEffect(() => {
    const node = ref.current;
    (node.querySelector('[data-autofocus]') || node.querySelector(FOCUSABLE) || node).focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation(); // keep the workspace's own Escape shortcut from also firing
        closeRef.current();
      } else if (event.key === 'Tab') {
        const items = [...node.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [opener]);

  return ref;
}

export default function Modal({ title, onClose, children, maxWidthClass = 'max-w-md' }) {
  const titleId = useId();
  const ref = useFocusLayer(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative max-h-[92vh] w-full ${maxWidthClass} animate-sheet-in overflow-y-auto rounded-t-lg border border-line-strong bg-page p-5 shadow-float sm:rounded-lg sm:p-6`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-serif text-xl font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="btn btn-quiet -mr-2 -mt-1 h-8 w-8 px-0">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
