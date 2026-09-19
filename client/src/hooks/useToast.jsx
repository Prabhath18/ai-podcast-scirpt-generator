import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { type = 'info', durationMs = 4000 } = {}) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, message, type }]);
      if (durationMs > 0) {
        setTimeout(() => dismiss(id), durationMs);
      }
      return id;
    },
    [dismiss],
  );

  const toast = {
    show: push,
    success: (message, opts) => push(message, { ...opts, type: 'success' }),
    error: (message, opts) => push(message, { ...opts, type: 'error' }),
    info: (message, opts) => push(message, { ...opts, type: 'info' }),
  };

  return <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>;
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
