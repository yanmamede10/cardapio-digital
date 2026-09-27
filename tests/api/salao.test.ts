import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { ADMIN_KEY, SEED_MODULES, call, firstLogin, setModules, uid } from "./helpers.ts";

// Salão of the demo hamburgueria (prisma/seed-demo.ts): QR → pedido → Central → comanda → fechamento.
const D = "chapa27";
const P = `/api/restaurants/${D}`;
let owner: string;
let waiter: string;
let kitchen: string;
let items: { id: string; name: string; price: number; optionGroups: { id: string; options: { id: string; label: string; priceDelta: number }[] }[] }[];
const item = (name: string) => items.find((i) => i.name === name)!;
const staff = async (u: string) => (await call("POST", "/api/auth/login", { body: { email: `${u}@chapa27.example`, password: "senha123" } })).body.token as string;

before(async () => {
  [owner, waiter, kitchen] = await Promise.all([staff("dono"), staff("garcom"), staff("cozinha")]);
  items = (await call("GET", `${P}/items`)).body;
});

describe("QR da mesa", () => {
  test("o QR de uma mesa abre o restaurante dela, não outro", async () => {
    const { tableCode } = (await call("GET", `${P}/tables/12/qr`, { token: waiter })).body;
    assert.equal(tableCode, "chapa27.12");
    assert.deepEqual((await call("GET", `/api/tables/${tableCode}`)).body, { restaurantId: D, tableNumber: 12 });
  });

  test("mesa que não existe, restaurante inexistente ou inativo, código sem restaurante → 404", async () => {
    for (const code of ["chapa27.99", "naoexiste.1", "12", "chapa27.", ".3", "chapa27.1.5"]) {
      assert.equal((await call("GET", `/api/tables/${encodeURIComponent(code)}`)).status, 404, code);
    }
    // A restaurant of its own, so deactivating it can't disturb other tests.
    const email = `dono-qr-${uid()}@t.com`;
    const r = (await call("POST", "/api/admin/restaurants", { token: ADMIN_KEY, body: { name: `QR ${uid()}`, cnpj: String(Date.now()).slice(-12) + "31", ownerName: "Dona QR", ownerEmail: email } })).body;
    const status = (s: string) => call("PATCH", `/api/admin/restaurants/${r.id}/status`, { token: ADMIN_KEY, body: { status: s } });
    await status("ativo");
    await call("POST", `/api/restaurants/${r.id}/tables`, { token: await firstLogin(email, r.ownerPassword), body: { seats: 2 } });
    assert.equal((await call("GET", `/api/tables/${r.id}.1`)).status, 200);
    await status("inativo");
    assert.equal((await call("GET", `/api/tables/${r.id}.1`)).status, 404, "restaurante inativo");
  });
});

/** A guest order at a table of the demo restaurant. */
const order = (table: number, lines: { name: string; qty?: number; options?: string[]; notes?: string }[], session = `s-${uid()}`) =>
  call("POST", "/api/orders", {
    session,
    body: {
      mode: "table",
      restaurantId: D,
      tableNumber: table,
      guestName: "Cliente",
      lines: lines.map((l) => {
        const it = item(l.name);
        const selectedOptions = (l.options ?? []).map((label) => {
          const g = it.optionGroups.find((g) => g.options.some((o) => o.label === label))!;
          return { groupId: g.id, optionId: g.options.find((o) => o.label === label)!.id };
        });
        return { itemId: it.id, quantity: l.qty ?? 1, notes: l.notes ?? "", selectedOptions };
      })
    }
  });
const comanda = async (table: number) => (await call("GET", `${P}/tables/${table}/comanda`, { token: waiter })).body;
const close = (table: number, body?: object) => call("POST", `${P}/tables/${table}/close`, { token: waiter, body });
const transfer = (from: number, to: number) => call("POST", `${P}/tables/${from}/transfer`, { token: waiter, body: { toNumber: to } });
/** Tests own their tables: whatever an earlier run left open there is closed first. */
const fresh = (...tables: number[]) => Promise.all(tables.map((t) => close(t)));
const tableStatus = async (n: number) => (await call("GET", `${P}/tables`, { token: waiter })).body.find((t: { number: number }) => t.number === n).status;

describe("comanda", () => {
  test("transferir para uma mesa que acabou de ser paga não traz de volta a conta anterior dela", async () => {
    await fresh(13, 14);
    const a = (await order(13, [{ name: "Clássico" }])).body; // 13 opens first
    const b = (await order(14, [{ name: "Picanha" }])).body; // 14 opens later, is paid and freed
    await close(14);
    assert.equal((await transfer(13, 14)).status, 200);
    assert.deepEqual((await comanda(14)).orderIds, [a.id], `o pedido já pago ${b.id} não pode voltar a ser cobrado`);
    assert.equal(await tableStatus(13), "free");
  });

  test("transferir para uma mesa aberta sem pedidos válidos não some com os pedidos", async () => {
    await fresh(15, 16);
    const c = (await order(15, [{ name: "Salada" }])).body;
    const d = (await order(16, [{ name: "Kids" }])).body; // 16 opens later…
    await call("POST", `/api/orders/${d.id}/reject`, { token: kitchen }); // …and its only order is refused: "Livre", but opened
    await transfer(15, 16);
    assert.deepEqual((await comanda(16)).orderIds, [c.id]);
  });

  test("fecha só o que o garçom viu: pedido que chega durante o fechamento fica na mesa", async () => {
    await fresh(17);
    const e = (await order(17, [{ name: "Batata Frita" }])).body;
    const seen = (await comanda(17)).orderIds;
    const f = (await order(17, [{ name: "Onion Rings" }])).body; // arrives while the waiter is at the card machine
    const res = await close(17, { orderIds: seen, paymentMethod: "Cartão" });
    assert.deepEqual([res.status, res.body.closed, res.body.remaining], [200, 1, 1]);
    assert.deepEqual((await comanda(17)).orderIds, [f.id]);
    assert.equal(await tableStatus(17), "occupied");
    assert.notEqual(e.id, f.id);
  });

  test("dois garçons fecham a mesma mesa ao mesmo tempo: um fecha, nada em dobro", async () => {
    await fresh(18);
    await order(18, [{ name: "Chope Pilsen 300 ml", qty: 2 }]);
    const ids = (await comanda(18)).orderIds;
    const results = await Promise.all([close(18, { orderIds: ids }), close(18, { orderIds: ids }), close(18)]);
    assert.deepEqual(results.map((r) => r.body.closed).sort(), [0, 0, 1]);
    const out = (await call("GET", `${P}/stock-movements`, { token: owner })).body.filter((m: { productName: string; source: string }) => m.productName === "Chope pilsen (barril)" && m.source.includes(results.find((r) => r.body.closed)!.body.code));
    assert.equal(out.length, 1);
  });

  test("transferir e fechar ao mesmo tempo: nenhum pedido cobrado duas vezes nem perdido", async () => {
    await fresh(19, 20);
    const g = (await order(19, [{ name: "Nuggets (10 un)" }])).body;
    const ids = (await comanda(19)).orderIds;
    await Promise.all([transfer(19, 20), close(19, { orderIds: ids })]);
    const [c19, c20] = await Promise.all([comanda(19), comanda(20)]);
    const stillOpen = [...c19.orderIds, ...c20.orderIds].filter((id: string) => id === g.id).length;
    const closedMoves = (await call("GET", `${P}/stock-movements`, { token: owner })).body.filter((m: { source: string }) => m.source === `Fechamento de comanda ${g.code}`).length;
    assert.equal(stillOpen + (closedMoves > 0 ? 1 : 0), 1, "fechado uma vez ou ainda aberto numa mesa — nunca os dois, nunca nenhum");
    if (c20.orderIds.length) await close(20);
  });
});

describe("fechamento → Contas a Receber", () => {
  const receivables = async () => (await call("GET", `${P}/finance-entries?kind=receivable`, { token: owner })).body as { description: string; amount: number; status: string; paidOn: string; paymentMethod: string; category: string }[];
  const setService = (serviceCharge: boolean) => call("PATCH", `${P}/payment-mode`, { token: owner, body: { serviceCharge } });
  const today = () => new Date().toLocaleDateString("sv-SE");

  test("a conta fechada vira recebível pago, com o valor cobrado (centavos) e a forma da maquininha", async () => {
    await fresh(21);
    await order(21, [{ name: "Refrigerante lata 350 ml", qty: 3 }, { name: "Chope Pilsen 300 ml" }]);
    const c = await comanda(21);
    assert.deepEqual([c.subtotal, c.service, c.total], [32.9, 3.29, 36.19]);
    const res = await close(21, { orderIds: c.orderIds, paymentMethod: "Cartão" });
    const entry = (await receivables()).find((e) => e.description.includes(res.body.code))!;
    assert.deepEqual([entry.amount, entry.status, entry.paidOn, entry.paymentMethod, entry.category], [36.19, "paid", today(), "Cartão", "Vendas salão"]);
    assert.match(entry.description, /Mesa 21/);
  });

  test("serviço desligado: a comanda e o recebível saem sem os 10%", async () => {
    try {
      assert.equal((await setService(false)).body.serviceCharge, false);
      await fresh(22);
      await order(22, [{ name: "Clássico", qty: 2 }]);
      const c = await comanda(22);
      assert.deepEqual([c.servicePct, c.service, c.total], [0, 0, 65.8]);
      const res = await close(22, { orderIds: c.orderIds, paymentMethod: "PIX" });
      assert.equal((await receivables()).find((e) => e.description.includes(res.body.code))!.amount, 65.8);
    } finally {
      await setService(true);
    }
    assert.equal((await call("GET", `${P}/payment-mode`, { token: owner })).body.serviceCharge, true);
  });

  test("forma de pagamento inválida → 400 e nada é fechado; duplo clique lança uma vez só", async () => {
    await fresh(23);
    await order(23, [{ name: "Kids" }]);
    const ids = (await comanda(23)).orderIds;
    assert.equal((await close(23, { orderIds: ids, paymentMethod: "Cheque" })).status, 400);
    assert.deepEqual((await comanda(23)).orderIds, ids);
    const [a, b] = await Promise.all([close(23, { orderIds: ids, paymentMethod: "Dinheiro" }), close(23, { orderIds: ids, paymentMethod: "Dinheiro" })]);
    const code = a.body.code ?? b.body.code;
    assert.equal((await receivables()).filter((e) => e.description.includes(code)).length, 1);
  });

  test("com Contas a Receber desligado, fecha a conta sem lançar", async () => {
    let res;
    try {
      await fresh(24);
      await setModules(SEED_MODULES.filter((m) => m !== "receber"), D);
      await order(24, [{ name: "Batata Frita" }]);
      res = await close(24, { paymentMethod: "Cartão" });
      assert.equal(res.body.closed, 1);
    } finally {
      await setModules(SEED_MODULES, D);
    }
    assert.equal((await receivables()).some((e) => e.description.includes(res.body.code)), false);
  });
});
