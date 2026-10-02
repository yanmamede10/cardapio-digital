/** Money as both apps show it: 1340.5 → "R$ 1.340,50"; -1340.5 → "-R$ 1.340,50" (sign before the symbol; no "-R$ 0,00"). */
export function brl(n: number): string {
  const abs = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 && abs !== "0,00" ? "-R$ " : "R$ ") + abs;
}
