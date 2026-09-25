import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@cardapio/shared";
import { getSession } from "../lib/api";

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

  const session = getSession();
  const value: DashboardStateValue = {
    theme,
    toggleTheme,
    staffName: session?.name ?? "",
    staffRole: session ? ROLE_LABEL[session.role] ?? session.role : "",
    toast,
    notify
  };

  return (
    // id: portal target for overlays that must escape a screen's stacking context but keep the theme tokens.
    <div id="theme-root" className={theme === "dark" ? "dark" : undefined} style={{ minHeight: "100vh", color: "var(--ink)" }}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </div>
  );
}

export function useDashboardState(): DashboardStateValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardState must be used inside DashboardStateProvider");
  return ctx;
}
