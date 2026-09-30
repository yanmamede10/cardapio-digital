import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ALL_MODULES, R, SEED_MODULES, accepted, call, login, newTable, setModules, uid } from "./helpers.ts";

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

  const setService = (serviceCharge: boolean) => call("PATCH", `${P}/payment-mode`, { token: owner, body: { serviceCharge } });
  const row = async (id: string) => (await call("GET", `${P}/closed-orders`, { token: owner })).body.find((o: { id: string }) => o.id === id);
  const receivable = async (table: number, code: string) =>
    (await call("GET", `${P}/finance-entries?kind=receivable`, { token: owner })).body.find((e: { description: string }) => e.description === `Mesa ${table} · comanda ${code}`)?.amount;
  /** `count` served orders at a fresh table, the comanda the waiter sees, and closing exactly that comanda (→ its code). */
  async function servedTable(count = 1) {
    const items = ((await call("GET", `${P}/items`, { token: owner })).body as { id: string; soldOut: boolean }[]).filter((i) => !i.soldOut);
    const { number: table, code } = await newTable(owner);
    const orders: { id: string; total: number }[] = [];
    for (let i = 0; i < count; i++) {
      const order = (await accepted(await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: R, tableCode: code, lines: [{ itemId: items[i % items.length].id, quantity: 1, notes: "", selectedOptions: [] }] } }), owner)).body;
      await call("PATCH", `/api/orders/${order.id}/stage`, { token: owner, body: { stage: "served" } });
      orders.push(order);
    }
    const comanda = (await call("GET", `${P}/tables/${table}/comanda`, { token: owner })).body;
    const close = async (): Promise<string> => (await call("POST", `${P}/tables/${table}/close`, { token: owner, body: { orderIds: comanda.orderIds } })).body.code;
    return { table, order: orders[0], orders, comanda, close };
  }

  test("o fechamento e o serviço são gravados juntos: a fila nunca vê a comanda fechada com serviço 0", async () => {
    const t = await servedTable(20);
    const ids = new Set(t.orders.map((o) => o.id));
    const rows = async () => ((await call("GET", `${P}/closed-orders`, { token: owner })).body as { id: string; total: number }[]).filter((r) => ids.has(r.id));
    // Two readers poll the queue while the comanda closes: whatever they catch must already be the final value.
    let closing = true;
    const seen: { id: string; total: number }[] = [];
    const watch = async () => {
      while (closing) seen.push(...(await rows()));
    };
    const watchers = [watch(), watch()];
    await t.close();
    closing = false;
    await Promise.all(watchers);
    const final = new Map((await rows()).map((r) => [r.id, r.total]));
    assert.equal(final.size, 20);
    assert.equal(Math.round([...final.values()].reduce((a, b) => a + b, 0) * 100) / 100, t.comanda.total, "a nota soma o que a comanda cobrou");
    assert.deepEqual(seen.filter((r) => r.total !== final.get(r.id)), [], "pedido visto fechado antes de o serviço ser gravado");
  });

  test("relatórios e turno: o serviço numa linha à parte, lido do fechamento; produtos + serviço = Contas a Receber do dia", async () => {
    const today = new Date().toLocaleDateString("sv-SE");
    const kpis = async () => (await call("GET", `${P}/analytics?period=today`, { token: owner })).body.kpis;
    const shift = async () => (await call("GET", `${P}/shift-stats`, { token: owner })).body;
    const received = async () => ((await call("GET", `${P}/finance-entries?kind=receivable`, { token: owner })).body as { dueDate: string; amount: number }[]).filter((e) => e.dueDate === today).reduce((t, e) => t + e.amount, 0);
    const before = { k: await kpis(), s: await shift(), r: await received() };
    const t = await servedTable(3);
    await t.close();
    try {
      await setService(false); // changing the setting afterwards must not change what was charged
      const after = { k: await kpis(), s: await shift(), r: await received() };
      const d = (a: number, b: number) => Math.round((a - b) * 100) / 100;
      assert.ok(t.comanda.service > 0);
      assert.equal(d(after.r, before.r), t.comanda.total, "o recebível da comanda");
      assert.deepEqual([d(after.k.revenue, before.k.revenue), d(after.k.service, before.k.service)], [t.comanda.subtotal, t.comanda.service], "Relatórios: produtos e serviço separados");
      assert.equal(d(after.k.total, before.k.total), d(after.r, before.r), "Relatórios: total = Contas a Receber");
      assert.deepEqual([d(after.s.shiftRevenue, before.s.shiftRevenue), d(after.s.shiftService, before.s.shiftService)], [t.comanda.subtotal, t.comanda.service], "turno: produtos e serviço separados");
      assert.equal(d(after.s.shiftTotal, before.s.shiftTotal), d(after.r, before.r), "turno: total = Contas a Receber");
    } finally {
      await setService(true);
    }
  });

  test("lista a comanda só depois de fechada, pelo valor cobrado (com serviço)", async () => {
    const t = await servedTable();
    assert.equal(await row(t.order.id), undefined, "servido mas com a mesa aberta ainda não é elegível");
    await t.close();
    assert.ok(t.comanda.service > 0);
    assert.equal((await row(t.order.id))?.total, t.comanda.total, "nota = pedido + serviço, o mesmo valor cobrado na comanda");
  });

  test("serviço desligado do começo ao fim: a nota tem o valor da comanda, sem os 10%", async () => {
    try {
      await setService(false);
      const t = await servedTable();
      assert.deepEqual([t.comanda.service, t.comanda.total], [0, t.order.total]);
      await t.close();
      assert.equal((await row(t.order.id))?.total, t.comanda.total);
    } finally {
      await setService(true);
    }
  });

  test("mudar a chave depois do fechamento não muda a nota: vale o que foi cobrado, igual ao Contas a Receber", async () => {
    try {
      const on = await servedTable();
      const onCode = await on.close();
      assert.ok(on.comanda.service > 0);
      await setService(false);
      assert.equal((await row(on.order.id))?.total, on.comanda.total, "fechada com serviço: continua com serviço depois de desligar");

      const off = await servedTable();
      const offCode = await off.close();
      assert.equal(off.comanda.service, 0);
      await setService(true);
      assert.equal((await row(off.order.id))?.total, off.comanda.total, "fechada sem serviço: continua sem depois de religar");

      assert.equal(await receivable(on.table, onCode), on.comanda.total);
      assert.equal(await receivable(off.table, offCode), off.comanda.total);
    } finally {
      await setService(true);
    }
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

describe("excluir lançamento", () => {
  const entry = async (kind = "payable", description = `Açougue São João ${uid()}`) =>
    (await call("POST", `${P}/finance-entries`, { token: owner, body: { kind, description, amount: 1234.56, dueDate: "2026-09-25", status: "pending", category: "Insumos e bebidas" } })).body;
  const list = async () => (await call("GET", `${P}/finance-entries`, { token: owner })).body as { id: string }[];

  test("Dono ou Administrador excluem; some da lista (Visão Geral e DRE leem a mesma)", async () => {
    const e = await entry();
    assert.equal(e.description.startsWith("Açougue São João"), true, "acento preservado");
    assert.equal((await call("DELETE", `${P}/finance-entries/${e.id}`, { token: await login("bruno@fogoeno.com.br") })).status, 204);
    assert.equal((await list()).some((x) => x.id === e.id), false);
    assert.equal((await call("DELETE", `${P}/finance-entries/${e.id}`, { token: owner })).status, 404, "já excluído");
  });

  test("garçom, outro restaurante e módulo desligado não excluem", async () => {
    const e = await entry();
    assert.equal((await call("DELETE", `${P}/finance-entries/${e.id}`, { token: waiter })).status, 403);
    assert.equal((await call("DELETE", `/api/restaurants/napoli/finance-entries/${e.id}`, { token: owner })).status, 403);
    try {
      await setModules(SEED_MODULES.filter((m) => m !== "pagar"));
      assert.equal((await call("DELETE", `${P}/finance-entries/${e.id}`, { token: owner })).status, 403);
    } finally {
      await setModules(SEED_MODULES);
    }
    assert.equal((await list()).some((x) => x.id === e.id), true);
  });

  test("descrição acima de 120 caracteres é recusada", async () => {
    assert.equal((await call("POST", `${P}/finance-entries`, { token: owner, body: { kind: "payable", description: "x".repeat(121), amount: 1, dueDate: "2026-09-25", status: "pending" } })).status, 400);
  });
});
