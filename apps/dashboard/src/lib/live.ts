import { useEffect, useState } from "react";

/**
 * Runs a request and falls back to a default value if it fails. The management
 * API is still being extended, so a single missing endpoint must never blank a
 * whole screen — every initial fetch goes through this.
 */
export async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/** Re-renders on an interval so elapsed-time labels stay live. */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
