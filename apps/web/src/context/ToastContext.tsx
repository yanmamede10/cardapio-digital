import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastState {
  message: string;
  icon: string;
}

interface ToastContextValue {
  toast: ToastState | null;
  showToast: (message: string, icon?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string, icon = "fa-solid fa-circle-check") => {
    clearTimeout(timerRef.current);
    setToast({ message, icon });
    timerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  return <ToastContext.Provider value={{ toast, showToast }}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
