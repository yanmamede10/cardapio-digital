import type { OperatingHoursRow } from "@cardapio/shared";

const DAY = 24 * 60;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // OperatingHoursRow.weekday: 0 = Monday

/** A shift typed in Configurações → Horários ("11:30 – 15:00", "18h – 2h") as minutes since midnight; one that ends at or
 *  before it starts runs past midnight. null when the text doesn't read as two times. */
function span(text: string): [number, number] | null {
  const t = [...text.matchAll(/(\d{1,2})(?:[:h](\d{2}))?/g)].map((m) => Number(m[1]) * 60 + Number(m[2] ?? 0));
  if (t.length !== 2) return null;
  return [t[0], t[1] > t[0] ? t[1] : t[1] + DAY];
}

/**
 * I-1: "Aberto agora" or "Fechado", and today's hours, from the restaurant's Horários — in São Paulo time, whatever the
 * phone's zone. Lunch and dinner both show; a shift past midnight (18:00 – 02:00) keeps it open into the next day.
 * null = no hours registered: the cardápio shows neither, instead of making some up. Display only: ordering isn't blocked.
 */
export function openingNow(rows: OperatingHoursRow[], now = new Date()): { open: boolean; today: string } | null {
  if (rows.length === 0) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((x) => [x.type, x.value])
  );
  const weekday = WEEKDAYS.indexOf(p.weekday);
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  const shifts = (day: number) => {
    const row = rows.find((r) => r.weekday === day);
    return row?.isOpen ? [row.lunch, row.dinner].map((t) => t.trim()).filter(Boolean) : [];
  };
  const today = shifts(weekday);
  const open =
    today.some((t) => { const s = span(t); return !!s && s[0] <= minutes && minutes < s[1]; }) ||
    shifts((weekday + 6) % 7).some((t) => { const s = span(t); return !!s && minutes + DAY < s[1]; });
  return { open, today: today.length ? `Hoje ${today.join(" · ")}` : "Fechado hoje" };
}
