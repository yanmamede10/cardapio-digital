export { brl } from "@cardapio/shared";

export function formatRating(v: number): string {
  return v.toFixed(1).replace(".", ",");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
}
