import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ToastTone = 'default' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  items: ToastItem[];
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3800);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, items, dismiss }), [toast, items, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`} role="status">
            <span className="toast__dot" aria-hidden="true" />
            <span className="toast__text">{item.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(item.id)} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de ToastProvider');
  return ctx;
}
