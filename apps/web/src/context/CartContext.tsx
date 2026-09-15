import type { CartLineSelectedOption } from "@cardapio/shared";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface LocalCartLine {
  key: string;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  selectedOptions: CartLineSelectedOption[];
}

interface CartContextValue {
  lines: LocalCartLine[];
  subtotal: number;
  count: number;
  addLine: (line: Omit<LocalCartLine, "key"> & { key?: string }) => void;
  incQty: (key: string) => void;
  decQty: (key: string) => void;
  removeLine: (key: string) => void;
  setNotes: (key: string, notes: string) => void;
  replaceAll: (lines: LocalCartLine[]) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function cartLineKey(itemId: string, selectedOptions: CartLineSelectedOption[], notes: string): string {
  const optSig = selectedOptions.map((o) => o.optionId).sort().join(",");
  return `${itemId}|${optSig}|${notes}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<LocalCartLine[]>([]);

  const addLine = useCallback((line: Omit<LocalCartLine, "key"> & { key?: string }) => {
    const key = line.key || cartLineKey(line.itemId, line.selectedOptions, line.notes);
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
        return next;
      }
      return [...prev, { ...line, key }];
    });
  }, []);

  const incQty = useCallback((key: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)));
  }, []);

  const decQty = useCallback((key: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const setNotes = useCallback((key: string, notes: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, notes } : l)));
  }, []);

  const replaceAll = useCallback((next: LocalCartLine[]) => setLines(next), []);
  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(() => lines.reduce((t, l) => t + l.unitPrice * l.quantity, 0), [lines]);
  const count = useMemo(() => lines.reduce((t, l) => t + l.quantity, 0), [lines]);

  const value = useMemo<CartContextValue>(
    () => ({ lines, subtotal, count, addLine, incQty, decQty, removeLine, setNotes, replaceAll, clear }),
    [lines, subtotal, count, addLine, incQty, decQty, removeLine, setNotes, replaceAll, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
