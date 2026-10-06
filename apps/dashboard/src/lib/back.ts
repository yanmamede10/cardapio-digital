import { useEffect, useRef } from "react";

// UX-08: Esc and the Android back button go to the topmost open panel first — a box over a sheet closes before the sheet.
// Each panel registers while it's open (useBack); with none open, the phone's back goes to the router (MobileLayout).
const stack: (() => void)[] = [];

/** While mounted, Esc and the Android back button call `handler` (unless something opened above it). */
export function useBack(handler: () => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const fn = () => latest.current();
    stack.push(fn);
    return () => {
      const i = stack.lastIndexOf(fn);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
}

/** Hands Esc / back to the topmost panel; false when none is open. */
export function back(): boolean {
  const top = stack.at(-1);
  top?.();
  return !!top;
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !e.defaultPrevented && back()) e.preventDefault();
  });
}
