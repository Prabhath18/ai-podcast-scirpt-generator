import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

/**
 * Toasts are short status messages. One can carry a single action, which is
 * how "Undo" works after a delete: { action: { label, onClick } }.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { type = 'info', durationMs = 4500, action } = {}) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-3), { id, message, type, action }]);
      if (durationMs > 0) setTimeout(() => dismiss(id), durationMs);
      return id;
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      show: push,
      success: (message, opts) => push(message, { ...opts, type: 'success' }),
      error: (message, opts) => push(message, { durationMs: 7000, ...opts, type: 'error' }),
      info: (message, opts) => push(message, { ...opts, type: 'info' }),
      warn: (message, opts) => push(message, { durationMs: 7000, ...opts, type: 'warn' }),
    }),
    [push],
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.toast;
}

export function useToastList() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastList must be used within a ToastProvider');
  return { toasts: ctx.toasts, dismiss: ctx.dismiss };
}
