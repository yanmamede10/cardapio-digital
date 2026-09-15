export function formatMoney(v: number): string {
  return "R$ " + v.toFixed(2).replace(".", ",");
}

export function formatRating(v: number): string {
  return v.toFixed(1).replace(".", ",");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
}
