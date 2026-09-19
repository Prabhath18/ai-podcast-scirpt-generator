import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastList } from '../hooks/useToast.jsx';

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const COLORS = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-accent',
};

export default function ToastViewport() {
  const { toasts, dismiss } = useToastList();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            role="status"
            className="flex items-start gap-3 rounded-xl border border-border bg-surface-raised shadow-popover p-3.5 animate-slide-in-right"
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${COLORS[t.type] || COLORS.info}`} aria-hidden="true" />
            <p className="text-sm text-ink flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-ink-faint hover:text-ink-muted"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
