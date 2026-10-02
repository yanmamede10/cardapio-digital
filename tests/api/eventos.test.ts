import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { R, call, login, newTable } from "./helpers.ts";

// OBS-01 (E-5): every change of an order's state is a row of OrderEvent, written with the change, saying who did it. Read
// straight from the test database — there's no route for it.
const db = new PrismaClient();
after(() => db.$disconnect());

const P = `/api/restaurants/${R}`;
const tokens: Record<string, string> = {};
const staffIds: Record<string, string> = {};
let item: { id: string };
const line = () => ({ itemId: item.id, quantity: 2, notes: "", selectedOptions: [] });

before(async () => {
  for (const [role, email] of [["owner", "marina@fogoeno.com.br"], ["waiter", "paula@fogoeno.com.br"], ["kitchen", "igor@fogoeno.com.br"]]) {
    tokens[role] = await login(email);
    staffIds[role] = (await call("GET", "/api/auth/me", { token: tokens[role] })).body.staff.id;
  }
  item = (await call("GET", `${P}/items`)).body.find((i: { soldOut: boolean; optionGroups: unknown[] }) => !i.soldOut && i.optionGroups.length === 0);
});

/** An order's history as [type, status, actor, channel or payment method]; staff rows also checked against who it was. */
async function history(orderId: string) {
  const events = await db.orderEvent.findMany({ where: { orderId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  for (const e of events) {
    assert.equal(e.restaurantId, R);
    assert.equal(e.staffId, staffIds[e.actor] ?? null, `${e.type}: staffId de ${e.actor}`);
  }
  return events.map((e) => [e.type, e.status, e.actor, e.channel ?? e.paymentMethod ?? null]);
}
const stage = (id: string, s: string, role: string) => call("PATCH", `/api/orders/${id}/stage`, { token: tokens[role], body: { stage: s } });

test("mesa livre até o fechamento: QR que espera o aceite, cozinha, garçom, um pedido lançado, outro do QR, e a comanda fechada no PIX", async () => {
  const session = crypto.randomUUID();
  const table = await newTable(tokens.owner);
  const qr = () => call("POST", "/api/orders", { session, body: { mode: "table", restaurantId: R, tableCode: table.code, lines: [line()] } });

  const first = (await qr()).body;
  assert.equal(first.status, "awaiting");
  assert.equal((await call("POST", `/api/orders/${first.id}/accept`, { token: tokens.waiter })).status, 200);
  assert.equal((await stage(first.id, "preparing", "kitchen")).status, 200);
  assert.equal((await stage(first.id, "ready", "kitchen")).status, 200);
  assert.equal((await stage(first.id, "ready", "kitchen")).status, 200, "clique repetido: nada muda");
  assert.equal((await stage(first.id, "served", "waiter")).status, 200);

  const launched = (await call("POST", `${P}/tables/${table.number}/orders`, { token: tokens.waiter, body: { lines: [line()] } })).body;
  const second = (await qr()).body; // the table is open now: no acceptance needed to join the comanda
  assert.equal(second.status, "pending");
  assert.equal((await call("POST", `/api/orders/${second.id}/accept`, { token: tokens.kitchen })).status, 200);

  const totals = await db.order.findMany({ where: { id: { in: [first.id, launched.id, second.id] } }, select: { id: true, subtotal: true, total: true } });
  const comanda = (await call("GET", `${P}/tables/${table.number}/comanda`, { token: tokens.waiter })).body;
  // Two waiters closing at once: one closes all three, the other nothing — and each order is closed once in its history.
  const closes = await Promise.all([1, 2].map(() => call("POST", `${P}/tables/${table.number}/close`, { token: tokens.waiter, body: { orderIds: comanda.orderIds, paymentMethod: "PIX" } })));
  assert.deepEqual(closes.map((r) => r.body.closed).sort(), [0, 3]);
  const close = closes.find((r) => r.body.closed)!;

  assert.deepEqual(await history(first.id), [
    ["criado", "awaiting", "cliente", "qr"],
    ["aguardando_aceite", "awaiting", "sistema", null],
    ["aceito", "pending", "waiter", null],
    ["status", "preparing", "kitchen", null],
    ["status", "ready", "kitchen", null],
    ["status", "served", "waiter", null],
    ["comanda_fechada", "served", "waiter", "PIX"]
  ]);
  assert.deepEqual(await history(launched.id), [
    ["criado", "preparing", "waiter", "garcom"],
    ["status", "served", "waiter", null], // served by the close itself: nobody had marked it
    ["comanda_fechada", "served", "waiter", "PIX"]
  ]);
  assert.deepEqual(await history(second.id), [
    ["criado", "pending", "cliente", "qr"],
    ["aceito", "preparing", "kitchen", null],
    ["status", "served", "waiter", null],
    ["comanda_fechada", "served", "waiter", "PIX"]
  ]);

  // No value moved: the orders kept what they were sold for, and Contas a Receber got the comanda's total.
  const after = await db.order.findMany({ where: { id: { in: totals.map((t) => t.id) } }, select: { id: true, subtotal: true, total: true } });
  assert.deepEqual(after.sort((a, b) => a.id.localeCompare(b.id)), totals.sort((a, b) => a.id.localeCompare(b.id)));
  const receivable = await db.financeEntry.findFirst({ where: { restaurantId: R, description: { contains: `comanda ${close.body.code}` } }, orderBy: { createdAt: "desc" } });
  assert.equal(receivable?.amount, comanda.total);
});

test("recusado: o 1º pedido de uma mesa livre, recusado pela cozinha; recusar de novo não grava nada", async () => {
  const table = await newTable(tokens.owner);
  const order = (await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: R, tableCode: table.code, lines: [line()] } })).body;
  assert.equal((await call("POST", `/api/orders/${order.id}/reject`, { token: tokens.kitchen })).status, 200);
  assert.equal((await call("POST", `/api/orders/${order.id}/reject`, { token: tokens.waiter })).status, 409);
  assert.deepEqual(await history(order.id), [
    ["criado", "awaiting", "cliente", "qr"],
    ["aguardando_aceite", "awaiting", "sistema", null],
    ["recusado", "cancelled", "kitchen", null]
  ]);
});

test("delivery: criado pelo cliente, aceito, saiu para entrega e entregue — cada passo com quem fez", async () => {
  const order = (await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "delivery", restaurantId: R, lines: [line()] } })).body;
  assert.equal((await call("POST", `/api/orders/${order.id}/accept`, { token: tokens.owner })).status, 200);
  assert.equal((await stage(order.id, "ready", "kitchen")).status, 200);
  assert.equal((await stage(order.id, "out_for_delivery", "waiter")).status, 200);
  assert.equal((await stage(order.id, "delivered", "waiter")).status, 200);
  assert.deepEqual(await history(order.id), [
    ["criado", "pending", "cliente", "delivery"],
    ["aceito", "preparing", "owner", null],
    ["status", "ready", "kitchen", null],
    ["status", "out_for_delivery", "waiter", null],
    ["status", "delivered", "waiter", null]
  ]);
});

test("dois aparelhos ao mesmo tempo (aceitar e recusar, aceitar e aceitar): uma linha por mudança que valeu, e a última é o status do pedido", async () => {
  for (const [a, b] of [["accept", "reject"], ["accept", "accept"]]) {
    const table = await newTable(tokens.owner);
    const order = (await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: R, tableCode: table.code, lines: [line()] } })).body;
    const results = await Promise.all([a, b].map((action) => call("POST", `/api/orders/${order.id}/${action}`, { token: tokens.waiter })));
    const won = results.filter((r) => r.status === 200).length;
    assert.ok(won >= 1, `${a} + ${b}: ${results.map((r) => r.status)}`);
    const steps = (await history(order.id)).slice(2); // after criado + aguardando_aceite
    assert.equal(steps.length, won, `${a} + ${b}: ${JSON.stringify(steps)}`);
    const status = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status;
    assert.equal(steps.at(-1)![1], status, `${a} + ${b}`);
  }
});
