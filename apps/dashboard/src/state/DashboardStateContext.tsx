import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const THEME_KEY = "mesapronta.theme";

export interface ToastState {
  message: string;
}

interface DashboardStateValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
  staffName: string;
  staffRole: string;
  toast: ToastState | null;
  notify: (message: string) => void;
}

const Ctx = createContext<DashboardStateValue | null>(null);

function loadTheme(): "light" | "dark" {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore
  }
  return "light";
}

export function DashboardStateProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(loadTheme);
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message });
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const value: DashboardStateValue = {
    theme,
    toggleTheme,
    staffName: (import.meta.env.VITE_STAFF_NAME as string | undefined) || "Marina Duarte",
    staffRole: (import.meta.env.VITE_STAFF_ROLE as string | undefined) || "Dono",
    toast,
    notify
  };

  return (
    <div className={theme === "dark" ? "dark" : undefined} style={{ minHeight: "100vh" }}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </div>
  );
}

export function useDashboardState(): DashboardStateValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardState must be used inside DashboardStateProvider");
  return ctx;
}
