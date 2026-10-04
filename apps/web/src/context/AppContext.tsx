import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type OrderMode = "table" | "delivery";
export type Theme = "light" | "dark";

interface TableSession {
  rounds: number;
  tableTotal: number;
  waiterCalled: boolean;
  lastOrderId: string | null;
}

interface AppState {
  mode: OrderMode;
  tableNumber: number | null;
  /** The code of the table's QR (or fixed tablet): what a table order is placed with. */
  tableCode: string | null;
  restaurantId: string | null;
  guestName: string;
  theme: Theme;
  tableSession: TableSession;
  paymentMethodId: string | null;
  couponCode: string | null;
  /** The applied coupon's rule (from /api/coupons/apply): the checkout shows its discount with couponDiscount. */
  coupon: { kind: "percent" | "fixed"; value: number } | null;
}

interface AppContextValue extends AppState {
  enterTableMode: (restaurantId: string, tableNumber: number, tableCode: string) => void;
  setActiveRestaurant: (restaurantId: string) => void;
  setGuestName: (name: string) => void;
  toggleTheme: () => void;
  registerTableOrder: (total: number, orderId: string) => void;
  setWaiterCalled: (called: boolean) => void;
  setPaymentMethodId: (id: string) => void;
  setCoupon: (code: string | null, coupon: AppState["coupon"]) => void;
}

const SESSION_STATE_KEY = "cardapio.tableSession";
const THEME_KEY = "cardapio.theme";

function loadInitialState(): AppState {
  const stored = sessionStorage.getItem(SESSION_STATE_KEY);
  const base: AppState = {
    mode: "delivery",
    tableNumber: null,
    tableCode: null,
    restaurantId: null,
    guestName: "",
    theme: (localStorage.getItem(THEME_KEY) as Theme | null) ||
      (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    tableSession: { rounds: 0, tableTotal: 0, waiterCalled: false, lastOrderId: null },
    paymentMethodId: null,
    couponCode: null,
    coupon: null
  };
  if (stored) {
    try {
      return { ...base, ...JSON.parse(stored), theme: base.theme };
    } catch {
      return base;
    }
  }
  return base;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadInitialState);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem(THEME_KEY, state.theme);
  }, [state.theme]);

  useEffect(() => {
    const { mode, tableNumber, tableCode, restaurantId, guestName, tableSession, paymentMethodId } = state;
    sessionStorage.setItem(
      SESSION_STATE_KEY,
      JSON.stringify({ mode, tableNumber, tableCode, restaurantId, guestName, tableSession, paymentMethodId })
    );
  }, [state]);

  const enterTableMode = useCallback((restaurantId: string, tableNumber: number, tableCode: string) => {
    setState((s) => ({ ...s, mode: "table", restaurantId, tableNumber, tableCode }));
  }, []);

  const setActiveRestaurant = useCallback((restaurantId: string) => {
    setState((s) => ({ ...s, restaurantId }));
  }, []);

  const setGuestName = useCallback((name: string) => {
    setState((s) => ({ ...s, guestName: name }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));
  }, []);

  const registerTableOrder = useCallback((total: number, orderId: string) => {
    setState((s) => ({
      ...s,
      tableSession: {
        ...s.tableSession,
        rounds: s.tableSession.rounds + 1,
        tableTotal: s.tableSession.tableTotal + total,
        lastOrderId: orderId
      }
    }));
  }, []);

  const setWaiterCalled = useCallback((called: boolean) => {
    setState((s) => ({ ...s, tableSession: { ...s.tableSession, waiterCalled: called } }));
  }, []);

  const setPaymentMethodId = useCallback((id: string) => {
    setState((s) => ({ ...s, paymentMethodId: id }));
  }, []);

  const setCoupon = useCallback((code: string | null, coupon: AppState["coupon"]) => {
    setState((s) => ({ ...s, couponCode: code, coupon }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      enterTableMode,
      setActiveRestaurant,
      setGuestName,
      toggleTheme,
      registerTableOrder,
      setWaiterCalled,
      setPaymentMethodId,
      setCoupon
    }),
    [
      state,
      enterTableMode,
      setActiveRestaurant,
      setGuestName,
      toggleTheme,
      registerTableOrder,
      setWaiterCalled,
      setPaymentMethodId,
      setCoupon
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
