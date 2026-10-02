import assert from "node:assert/strict";
import { test } from "node:test";
import { R, call, login, newTable } from "./helpers.ts";

// F-3 (SEG-A07): once an order's comanda is closed (paid), its status never changes again — 409 with the reason — so the
// Relatórios (which drop cancelled orders) and Contas a Receber (what was charged) keep agreeing.
const P = `/api/restaurants/${R}`;

test("pedido de comanda paga não vira cancelado (nem nada): 409 com o motivo, e Relatórios e Contas a Receber continuam batendo", async () => {
  const [owner, waiter] = await Promise.all([login(), login("paula@fogoeno.com.br")]);
  const item = (await call("GET", `${P}/items`)).body.find((i: { soldOut: boolean; optionGroups: unknown[] }) => !i.soldOut && i.optionGroups.length === 0);
  const table = await newTable(owner);
  const order = (await call("POST", `${P}/tables/${table.number}/orders`, { token: waiter, body: { lines: [{ itemId: item.id, quantity: 2, notes: "", selectedOptions: [] }] } })).body;
  const close = await call("POST", `${P}/tables/${table.number}/close`, { token: waiter, body: { paymentMethod: "Cartão" } });
  assert.equal(close.body.closed, 1);

  const snapshot = async () => ({
    kpis: (await call("GET", `${P}/analytics?period=today`, { token: owner })).body.kpis,
    receivable: (await call("GET", `${P}/finance-entries?kind=receivable`, { token: owner })).body.filter((e: { description: string }) => e.description.includes(close.body.code)),
    order: (await call("GET", `${P}/orders`, { token: owner })).body.find((o: { id: string }) => o.id === order.id)
  });
  const before = await snapshot();
  assert.equal(before.order.status, "served");
  assert.ok(before.order.closedAt, "o pedido diz quando a comanda fechou (a Central não oferece mover o cartão)");
  assert.equal(before.receivable.length, 1);

  const message = "Comanda já fechada: o status deste pedido não muda mais.";
  for (const stage of ["cancelled", "preparing", "ready", "served"]) {
    const res = await call("PATCH", `/api/orders/${order.id}/stage`, { token: owner, body: { stage } });
    assert.deepEqual([res.status, res.body.error], [409, message], stage);
  }
  for (const action of ["accept", "reject"]) {
    const res = await call("POST", `/api/orders/${order.id}/${action}`, { token: owner });
    assert.deepEqual([res.status, res.body.error], [409, message], action);
  }
  assert.deepEqual(await snapshot(), before, "status, Relatórios e Contas a Receber iguais");
});
