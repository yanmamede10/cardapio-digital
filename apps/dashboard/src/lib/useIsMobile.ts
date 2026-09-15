import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

function matches(): boolean {
  return typeof window !== "undefined" ? window.matchMedia(QUERY).matches : false;
}

/** Drives the desktop/mobile dashboard split in App.tsx. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
