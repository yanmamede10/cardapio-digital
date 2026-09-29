import assert from "node:assert/strict";
import { before, test } from "node:test";
import { SEED_MODULES, call, setModules } from "./helpers.ts";

// Lançar pedido: the waiter orders for the table from the dashboard, without the customer's phone.
const D = "chapa27";
const P = `/api/restaurants/${D}`;
const tokens: Record<string, string> = {};
let items: { id: string; name: string; optionGroups: { id: string; options: { id: string; label: string }[] }[] }[];
const item = (n: string) => items.find((i) => i.name === n)!;
const launch = (table: number, lines: object[], who = "garcom") => call("POST", `${P}/tables/${table}/orders`, { token: tokens[who], body: { lines } });
const line = (name: string, over: object = {}) => ({ itemId: item(name).id, quantity: 1, notes: "", selectedOptions: [], ...over });

before(async () => {
  for (const u of ["dono", "garcom", "cozinha"]) tokens[u] = (await call("POST", "/api/auth/login", { body: { email: `${u}@chapa27.example`, password: "senha123" } })).body.token;
  items = (await call("GET", `${P}/items`)).body;
  await call("POST", `${P}/tables/11/close`, { token: tokens.garcom });
});

test("o garçom lança o pedido da mesa: vai para a Central com o nome dele e entra na comanda", async () => {
  const res = await launch(11, [line("Cheddar & Bacon", { quantity: 2, notes: "sem cebola", selectedOptions: [{ groupId: "ponto", optionId: "ponto-1" }, { groupId: "extra", optionId: "extra-0" }] }), line("Refrigerante lata 350 ml")]);
  assert.equal(res.status, 201);
  assert.deepEqual([res.body.tableNumber, res.body.waiterName, res.body.status, res.body.total], [11, "Diego Alves", "preparing", 96.8], "vai direto para Preparando");
  assert.equal((await call("POST", `/api/orders/${res.body.id}/accept`, { token: tokens.cozinha })).status, 409, "não há o que aceitar");
  const central = (await call("GET", `${P}/orders`, { token: tokens.cozinha })).body.find((o: { id: string }) => o.id === res.body.id);
  assert.equal(central.waiterName, "Diego Alves");
  assert.deepEqual(central.lines[0].selectedOptions.map((o: { label: string }) => o.label), ["Bem passado", "Bacon extra"]);
  assert.deepEqual((await call("GET", `${P}/tables/11/comanda`, { token: tokens.garcom })).body.orderIds, [res.body.id]);
  const second = await launch(11, [line("Chope Pilsen 300 ml", { quantity: 2 })]);
  assert.equal(second.body.round, 2, "segunda rodada do mesmo garçom");
  assert.equal((await call("GET", `${P}/tables/11/comanda`, { token: tokens.garcom })).body.orderIds.length, 2);
});

test("mesmas regras do pedido do cliente: esgotado, carrinho vazio, observação longa, mesa inexistente", async () => {
  const batata = item("Batata Frita");
  await call("PATCH", `${P}/items/${batata.id}/sold-out`, { token: tokens.cozinha, body: { soldOut: true } });
  try {
    const refused = await launch(11, [line("Batata Frita")]);
    assert.equal(refused.status, 400);
    assert.match(refused.body.error, /esgotado/);
  } finally {
    await call("PATCH", `${P}/items/${batata.id}/sold-out`, { token: tokens.cozinha, body: { soldOut: false } });
  }
  assert.equal((await launch(11, [])).status, 400);
  assert.equal((await launch(11, [line("Kids", { notes: "x".repeat(301) })])).status, 400);
  assert.equal((await launch(99, [line("Kids")])).status, 404, "só mesa cadastrada");
  assert.equal((await call("POST", `${P}/tables/11/orders`, { body: { lines: [line("Kids")] } })).status, 401, "precisa de login");
});

test("com Mesas desligado o garçom não lança", async () => {
  try {
    await setModules(SEED_MODULES.filter((m) => m !== "mesas"), D);
    assert.equal((await launch(11, [line("Kids")])).status, 403);
  } finally {
    await setModules(SEED_MODULES, D);
  }
});

test("pedido pelo QR desligado: o QR e o pedido do cliente na mesa são recusados; o garçom e o delivery seguem", async () => {
  const setQr = (qrOrdering: unknown) => call("PATCH", `${P}/payment-mode`, { token: tokens.dono, body: { qrOrdering } });
  assert.equal((await setQr("não")).status, 400);
  try {
    assert.equal((await setQr(false)).body.qrOrdering, false);
    assert.equal((await call("GET", "/api/tables/chapa27.3")).status, 403);
    const customer = await call("POST", "/api/orders", { session: "qr-off", body: { mode: "table", restaurantId: D, tableNumber: 3, lines: [line("Kids")] } });
    assert.equal(customer.status, 403);
    assert.match(customer.body.error, /garçom/);
    assert.equal((await launch(3, [line("Kids")])).status, 201, "o garçom lança normalmente");
    assert.equal((await call("POST", "/api/orders", { session: "qr-off", body: { mode: "delivery", restaurantId: D, lines: [line("Kids")] } })).status, 201, "delivery não depende da opção");
  } finally {
    await setQr(true);
  }
  assert.equal((await call("GET", "/api/tables/chapa27.3")).status, 200);
  await call("POST", `${P}/tables/3/close`, { token: tokens.garcom });
});
