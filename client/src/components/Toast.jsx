import { X } from 'lucide-react';
import { useToastList } from '../hooks/useToast.jsx';

// A 3px bar in the semantic color carries the type; the text stays neutral.
const BAR = { success: 'bg-ok', error: 'bg-danger', warn: 'bg-warn', info: 'bg-line-strong' };

export default function ToastViewport() {
  const { toasts, dismiss } = useToastList();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col gap-2 p-4 sm:inset-x-auto sm:left-4 sm:max-w-sm"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex animate-rise-in items-stretch overflow-hidden rounded-lg border border-line-strong bg-page shadow-float"
        >
          <span className={`w-[3px] shrink-0 ${BAR[t.type] || BAR.info}`} aria-hidden="true" />
          <p className="flex-1 px-3 py-2.5 text-sm text-ink">{t.message}</p>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action.onClick();
                dismiss(t.id);
              }}
              className="px-3 text-sm font-semibold text-accent hover:underline"
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="px-2.5 text-ink-faint hover:text-ink">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
