export function brl(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function fmtMinutes(m: number): string {
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m} min`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function stars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}
