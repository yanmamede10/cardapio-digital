import assert from "node:assert/strict";
import { before, test } from "node:test";
import { ADMIN_KEY, R as FOGO, call, firstLogin, login, newTable, product, uid } from "./helpers.ts";

// Big lists: 150 products and 150 bills on a restaurant of their own, 120 orders in one day at "fogo" (a new restaurant
// has no categories, so no dishes to order). Every list still answers whole, fast, and the sums still add up.
let R: string;
let token: string;
const timed = async (path: string, t = token) => {
  const start = performance.now();
  const res = await call("GET", path, { token: t });
  return { ...res, ms: performance.now() - start };
};
const batch = <T>(n: number, fn: (i: number) => Promise<T>) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

before(async () => {
  const email = `dono-grande-${uid()}@t.com`;
  const r = (await call("POST", "/api/admin/restaurants", { token: ADMIN_KEY, body: { name: `Grande ${uid()}`, cnpj: String(Date.now()).slice(-12) + "44", ownerName: "Dono Grande", ownerEmail: email } })).body;
  R = r.id;
  await call("PATCH", `/api/admin/restaurants/${R}/status`, { token: ADMIN_KEY, body: { status: "ativo" } });
  token = await firstLogin(email, r.ownerPassword);
});

test("150 produtos e 150 lançamentos: listas inteiras, rápidas, e a soma dos centavos bate", async () => {
  const P = `/api/restaurants/${R}`;
  const produtos = await batch(150, (i) => call("POST", `${P}/products`, { token, body: product({ name: `Produto ${String(i).padStart(3, "0")} — ç ã é`, type: "produto", price: 10 + i / 100, cost: 3 }) }));
  assert.ok(produtos.every((r) => r.status === 201));
  const contas = await batch(150, (i) => call("POST", `${P}/finance-entries`, { token, body: { kind: i % 2 ? "payable" : "receivable", description: `Conta ${i}`, amount: 0.01 * (i + 1), dueDate: "2026-09-25", status: "pending" } }));
  assert.ok(contas.every((r) => r.status === 201));

  const products = await timed(`${P}/products`);
  const entries = await timed(`${P}/finance-entries`);
  assert.equal(products.body.length, 150);
  assert.equal(entries.body.length, 150);
  assert.equal(Math.round(entries.body.reduce((t: number, e: { amount: number }) => t + e.amount, 0) * 100) / 100, 113.25, "0,01 + 0,02 + … + 1,50");
  for (const r of [products, entries]) assert.ok(r.ms < 1500, `${r.ms.toFixed(0)} ms`);
});

test("120 pedidos no mesmo dia: a Central recebe todos, o mapa e o turno respondem rápido", async () => {
  const owner = await login();
  const items = (await call("GET", `/api/restaurants/${FOGO}/items`)).body.filter((i: { soldOut: boolean }) => !i.soldOut);
  const tables: { number: number; code: string }[] = [];
  for (let i = 0; i < 40; i++) tables.push(await newTable(owner, FOGO));
  const before = (await call("GET", `/api/restaurants/${FOGO}/orders`, { token: owner })).body.length;
  const created = await batch(120, (i) =>
    call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: FOGO, tableCode: tables[i % 40].code, lines: [{ itemId: items[i % items.length].id, quantity: 1, notes: "", selectedOptions: [] }] } })
  );
  assert.ok(created.every((r) => r.status === 201), JSON.stringify(created.find((r) => r.status !== 201)?.body));
  const orders = await timed(`/api/restaurants/${FOGO}/orders`, owner);
  assert.equal(orders.body.length, before + 120);
  for (const path of ["salon-grid", "shift-stats", "waiter-calls"]) {
    const r = await timed(`/api/restaurants/${FOGO}/${path}`, owner);
    assert.ok(r.status === 200 && r.ms < 1500, `${path}: ${r.status} ${r.ms.toFixed(0)} ms`);
  }
  assert.ok(orders.ms < 1500, `${orders.ms.toFixed(0)} ms`);
  // No table was opened (nobody accepted a first order), so all 120 are still awaiting: refuse them, fogo's Central stays clean.
  await batch(120, (i) => call("POST", `/api/orders/${created[i].body.id}/reject`, { token: owner }));
});
