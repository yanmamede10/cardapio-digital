import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { R, SEED_MODULES, call, login, newTable, setModules } from "./helpers.ts";

// RF-DESC-03 (E-6): the customer app's restaurant list is the delivery module's. Without it the restaurant leaves the list and
// refuses delivery orders, and keeps working at the table: QR, tablet (the same link) and the waiter.
let owner: string;
let item: { id: string };
const line = () => ({ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] });
const listed = async (query = "") => ((await call("GET", `/api/restaurants/${query}`)).body as { id: string }[]).map((r) => r.id);

before(async () => {
  owner = await login();
  item = (await call("GET", `/api/restaurants/${R}/items`)).body.find((i: { soldOut: boolean }) => !i.soldOut);
});
after(() => setModules(SEED_MODULES));

test("lista do app do cliente: só restaurante ativo com o módulo Delivery; sem ele, some (também na busca) e o pedido de delivery é recusado", async () => {
  assert.ok((await listed()).includes(R), "com o módulo, aparece");
  await setModules(SEED_MODULES.filter((m) => m !== "delivery"));
  const all = await listed();
  assert.ok(!all.includes(R), "sem o módulo, some da lista");
  assert.ok(all.length > 0, "os outros restaurantes seguem na lista");
  assert.ok(!(await listed("?query=fogo")).includes(R), "nem pela busca");
  const order = await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "delivery", restaurantId: R, lines: [line()] } });
  assert.deepEqual([order.status, order.body.error], [403, "Este restaurante não recebe pedidos de delivery pelo app."]);
  await setModules(SEED_MODULES);
  assert.ok((await listed()).includes(R), "religado, volta");
  assert.equal((await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "delivery", restaurantId: R, lines: [line()] } })).status, 201);
});

test("sem o módulo Delivery o restaurante segue pela mesa: cardápio público, QR (ou tablet) com aceite, e o garçom lança", async () => {
  await setModules(SEED_MODULES.filter((m) => m !== "delivery"));
  for (const path of ["", "/categories", "/items", "/appearance"]) assert.equal((await call("GET", `/api/restaurants/${R}${path}`)).status, 200, `GET ${path || "/"}`);
  const table = await newTable(owner);
  assert.equal((await call("GET", `/api/tables/${table.code}`)).status, 200, "o QR abre o cardápio");
  const qr = await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: R, tableCode: table.code, lines: [line()] } });
  assert.deepEqual([qr.status, qr.body.status], [201, "awaiting"]);
  assert.equal((await call("POST", `/api/orders/${qr.body.id}/accept`, { token: owner })).status, 200);
  assert.equal((await call("POST", `/api/restaurants/${R}/tables/${table.number}/orders`, { token: owner, body: { lines: [line()] } })).status, 201, "o garçom lança");
});
