import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_KEY, ALL_MODULES, R, SEED_MODULES, call, login, setModules } from "./helpers.ts";

const P = `/api/restaurants/${R}`;
let owner: string;

before(async () => {
  owner = await login();
});
after(() => setModules(SEED_MODULES));

describe("módulos por restaurante", () => {
  test("restaurante de demonstração nasce sem Emissão Fiscal; /me devolve os módulos", async () => {
    const me = await call("GET", "/api/auth/me", { token: owner });
    assert.deepEqual(me.body.modules, SEED_MODULES);
    assert.equal((await call("GET", `${P}/closed-orders`, { token: owner })).status, 403);
  });

  test("desligar responde 403 já no request seguinte (mesmo token), religar devolve", async () => {
    // one representative route per module
    const routes: Record<string, [string, string]> = {
      pedidos: ["GET", `${P}/orders`],
      cardapio: ["POST", `${P}/categories/nao-existe/move`],
      mesas: ["GET", `${P}/tables`],
      promocoes: ["GET", `${P}/coupons`],
      atendimento: ["GET", `${P}/tickets`],
      produtos: ["GET", `${P}/products`],
      relatorios: ["GET", `${P}/analytics`],
      visao: ["GET", `${P}/finance-entries`],
      pagar: ["GET", `${P}/finance-entries?kind=payable`],
      receber: ["GET", `${P}/finance-entries?kind=receivable`],
      fiscal: ["GET", `${P}/closed-orders`]
    };
    await setModules([]);
    for (const [m, [method, path]] of Object.entries(routes)) assert.equal((await call(method, path, { token: owner, body: method === "GET" ? undefined : {} })).status, 403, m);
    assert.equal((await call("GET", `${P}/finance`, { token: owner })).status, 200, "Minha Fatura não é módulo");
    assert.equal((await call("GET", `${P}/profile`, { token: owner })).status, 200, "Configurações não é módulo");
    await setModules(ALL_MODULES);
    for (const [m, [method, path]] of Object.entries(routes)) assert.notEqual((await call(method, path, { token: owner, body: method === "GET" ? undefined : {} })).status, 403, m);
  });

  test("Contas a Pagar desligada não deixa lançar nem quitar conta a pagar; a receber segue", async () => {
    await setModules(ALL_MODULES);
    const entry = (await call("POST", `${P}/finance-entries`, { token: owner, body: { kind: "payable", description: "Gás", amount: 90, dueDate: "2026-09-30", status: "pending" } })).body;
    await setModules(ALL_MODULES.filter((m) => m !== "pagar"));
    assert.equal((await call("POST", `${P}/finance-entries`, { token: owner, body: { kind: "payable", description: "Luz", amount: 10, dueDate: "2026-09-30", status: "pending" } })).status, 403);
    assert.equal((await call("POST", `${P}/finance-entries/${entry.id}/pay`, { token: owner, body: { paidOn: "2026-09-22", paymentMethod: "PIX" } })).status, 403);
    const rec = await call("GET", `${P}/finance-entries?kind=receivable`, { token: owner });
    assert.equal(rec.status, 200);
    assert.ok(rec.body.every((e: { kind: string }) => e.kind === "receivable"));
  });

  test("valida a lista, 404 pra restaurante que não existe, e só o super admin altera", async () => {
    assert.equal((await setModules(["pedidos", "inventado"])).status, 400);
    assert.equal((await call("PATCH", `/api/admin/restaurants/${R}/modules`, { token: ADMIN_KEY, body: {} })).status, 400);
    assert.equal((await setModules(["pedidos"], "nao-existe")).status, 404);
    assert.equal((await call("PATCH", `/api/admin/restaurants/${R}/modules`, { token: owner, body: { modules: [] } })).status, 401, "token de staff");
  });
});
