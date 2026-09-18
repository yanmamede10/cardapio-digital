/** WCAG relative luminance of a #rrggbb color, 0 (black) – 1 (white). */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const f = (c: string) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(h.slice(0, 2)) + 0.7152 * f(h.slice(2, 4)) + 0.0722 * f(h.slice(4, 6));
}

/** Picks a readable near-black or near-white text/icon color to sit on top of `hex`. */
export function onColor(hex: string): string {
  return relativeLuminance(hex) > 0.38 ? "#1B1915" : "#FCF7D3";
}
