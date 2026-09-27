import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ALL_MODULES, R, SEED_MODULES, call, login, setModules, uid } from "./helpers.ts";

let owner: string;
let waiter: string;
const P = `/api/restaurants/${R}`;

before(async () => {
  owner = await login();
  waiter = await login("paula@fogoeno.com.br");
});

describe("contas a pagar / receber", () => {
  test("lançar pendente e quitar com data e forma", async () => {
    const created = await call("POST", `${P}/finance-entries`, { token: owner, body: { kind: "payable", description: `Aluguel ${uid()}`, amount: 6200.456, dueDate: "2026-09-25", status: "pending", category: "Aluguel", costCenter: "Administrativo" } });
    assert.equal(created.status, 201);
    assert.equal(created.body.amount, 6200.46, "arredonda para centavos");
    assert.equal(created.body.paidOn, null);

    const paid = await call("POST", `${P}/finance-entries/${created.body.id}/pay`, { token: owner, body: { paidOn: "2026-09-22", paymentMethod: "Transferência" } });
    assert.deepEqual([paid.body.status, paid.body.paidOn, paid.body.paymentMethod], ["paid", "2026-09-22", "Transferência"]);
  });

  test("lançar já pago grava a data de hoje", async () => {
    const res = await call("POST", `${P}/finance-entries`, { token: owner, body: { kind: "receivable", description: `Repasse ${uid()}`, amount: 100, dueDate: "2026-09-20", status: "paid" } });
    assert.equal(res.body.paidOn, new Date().toLocaleDateString("sv-SE"));
  });

  test("valida os campos", async () => {
    const base = { kind: "payable", description: "x", amount: 10, dueDate: "2026-09-30", status: "pending" };
    for (const bad of [{ kind: "outro" }, { description: " " }, { amount: 0 }, { dueDate: "30/09/2026" }, { status: "late" }]) {
      assert.equal((await call("POST", `${P}/finance-entries`, { token: owner, body: { ...base, ...bad } })).status, 400, JSON.stringify(bad));
    }
    const entry = (await call("POST", `${P}/finance-entries`, { token: owner, body: base })).body;
    assert.equal((await call("POST", `${P}/finance-entries/${entry.id}/pay`, { token: owner, body: { paidOn: "2026-09-22", paymentMethod: "Cheque" } })).status, 400);
    assert.equal((await call("POST", `${P}/finance-entries/nao-existe/pay`, { token: owner, body: { paidOn: "2026-09-22", paymentMethod: "PIX" } })).status, 404);
  });
});

describe("emissão fiscal", () => {
  before(() => setModules(ALL_MODULES)); // the seeded demo restaurant has it off
  after(() => setModules(SEED_MODULES));

  test("lista a comanda só depois de fechada, pelo valor cobrado (com serviço)", async () => {
    const items = (await call("GET", `${P}/items`, { token: owner })).body;
    const table = 100 + Math.floor(Math.random() * 800);
    const order = (await call("POST", "/api/orders", { session: `f-${uid()}`, body: { mode: "table", restaurantId: R, tableNumber: table, lines: [{ itemId: items[0].id, quantity: 1, notes: "", selectedOptions: [] }] } })).body;
    await call("PATCH", `/api/orders/${order.id}/stage`, { token: owner, body: { stage: "served" } });
    const comanda = (await call("GET", `${P}/tables/${table}/comanda`, { token: owner })).body;
    const row = async () => (await call("GET", `${P}/closed-orders`, { token: owner })).body.find((o: { id: string }) => o.id === order.id);

    assert.equal(await row(), undefined, "servido mas com a mesa aberta ainda não é elegível");
    await call("POST", `${P}/tables/${table}/close`, { token: owner });
    assert.ok(comanda.service > 0);
    assert.equal((await row())?.total, comanda.total, "nota = pedido + serviço, o mesmo valor cobrado na comanda");
  });
});

describe("acesso", () => {
  test("sem token → 401", async () => {
    assert.equal((await call("GET", `${P}/products`)).status, 401);
  });

  test("outro restaurante → 403", async () => {
    for (const path of ["products", "stock-movements", "finance-entries", "closed-orders"]) {
      assert.equal((await call("GET", `/api/restaurants/napoli/${path}`, { token: owner })).status, 403, path);
    }
  });

  test("garçom não acessa Produtos nem Financeiro", async () => {
    for (const path of ["products", "stock-movements", "finance-entries", "closed-orders"]) {
      assert.equal((await call("GET", `${P}/${path}`, { token: waiter })).status, 403, path);
    }
  });
});
