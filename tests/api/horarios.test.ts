import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingHoursRow } from "@cardapio/shared";
import { openingNow } from "../../apps/web/src/lib/hours.ts";

// I-1 (CARD-07): the cardápio's "Aberto agora" and today's hours come from Configurações → Horários, in São Paulo time.
// Week of 05/10/2026: Monday the 5th … Sunday the 11th. São Paulo is UTC−3 all year.
const at = (isoLocal: string) => new Date(`${isoLocal}-03:00`);
const week = (day: (weekday: number) => Partial<OperatingHoursRow>): OperatingHoursRow[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, lunch: "", dinner: "", isOpen: true, ...day(weekday) }));
// As the Chapa 27's seed: closed on Monday, lunch and dinner the other days.
const chapa = week((d) => (d === 0 ? { isOpen: false } : { lunch: "11:30 – 15:00", dinner: "18:00 – 23:30" }));

test("I-1 · dois turnos no dia: aberto no almoço e no jantar, fechado entre eles, e o horário de hoje mostra os dois", () => {
  const both = "Hoje 11:30 – 15:00 · 18:00 – 23:30";
  assert.deepEqual(openingNow(chapa, at("2026-10-06T12:00")), { open: true, today: both });
  assert.deepEqual(openingNow(chapa, at("2026-10-06T16:00")), { open: false, today: both });
  assert.deepEqual(openingNow(chapa, at("2026-10-06T19:00")), { open: true, today: both });
  assert.deepEqual(openingNow(chapa, at("2026-10-06T11:29")), { open: false, today: both });
  assert.deepEqual(openingNow(chapa, at("2026-10-06T23:30")), { open: false, today: both }, "fecha na hora que termina");
});

test("I-1 · 3 h da manhã: Fechado", () => {
  assert.equal(openingNow(chapa, at("2026-10-07T03:00"))?.open, false);
  // The same instant written in UTC: the device's zone doesn't matter.
  assert.equal(openingNow(chapa, new Date("2026-10-07T06:00:00Z"))?.open, false);
  assert.equal(openingNow(chapa, new Date("2026-10-07T15:00:00Z"))?.open, true, "12:00 em São Paulo");
});

test("I-1 · turno que passa da meia-noite (18:00 – 02:00): 01:00 do dia seguinte está Aberto, 02:00 já Fechado", () => {
  const late = week((d) => (d === 4 ? { dinner: "18:00 – 02:00" } : { isOpen: false })); // Friday only
  assert.deepEqual(openingNow(late, at("2026-10-09T23:00")), { open: true, today: "Hoje 18:00 – 02:00" });
  assert.deepEqual(openingNow(late, at("2026-10-10T01:00")), { open: true, today: "Fechado hoje" }, "sábado 01:00, ainda no turno de sexta");
  assert.deepEqual(openingNow(late, at("2026-10-10T02:00")), { open: false, today: "Fechado hoje" });
  assert.deepEqual(openingNow(late, at("2026-10-09T17:59")), { open: false, today: "Hoje 18:00 – 02:00" });
  // Sunday → Monday wraps around the week, and the times may be written "18h – 2h".
  const sunday = week((d) => (d === 6 ? { dinner: "18h – 2h" } : { isOpen: false }));
  assert.equal(openingNow(sunday, at("2026-10-12T01:30"))?.open, true);
});

test("I-1 · dia fechado: Fechado hoje, mesmo com horário escrito nos campos", () => {
  assert.deepEqual(openingNow(chapa, at("2026-10-05T12:00")), { open: false, today: "Fechado hoje" });
  const typedButOff = week(() => ({ lunch: "11:30 – 15:00", isOpen: false }));
  assert.deepEqual(openingNow(typedButOff, at("2026-10-06T12:00")), { open: false, today: "Fechado hoje" });
});

test("I-1 · restaurante sem horário cadastrado: nada a mostrar (nem selo, nem horário)", () => {
  assert.equal(openingNow([], at("2026-10-06T12:00")), null);
});
