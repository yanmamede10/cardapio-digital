/** Money as both apps show it: 1340.5 → "R$ 1.340,50"; -1340.5 → "-R$ 1.340,50" (sign before the symbol; no "-R$ 0,00"). */
export function brl(n: number): string {
  const abs = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 && abs !== "0,00" ? "-R$ " : "R$ ") + abs;
}

/** What a delivery coupon (Promoções) takes off the subtotal: a percentage of it, or a fixed amount — never more than the
 *  subtotal. The server freezes it on the order; the checkout uses the same function to show it beforehand. */
export function couponDiscount(c: { kind: string; value: number }, subtotal: number): number {
  const off = c.kind === "percent" ? subtotal * (c.value / 100) : c.kind === "fixed" ? c.value : 0;
  return Math.floor(Math.min(Math.max(off, 0), subtotal) * 100) / 100;
}
