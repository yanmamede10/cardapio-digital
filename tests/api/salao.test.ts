import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { ADMIN_KEY, SEED_MODULES, accepted, call, firstLogin, setModules, tableCode, uid } from "./helpers.ts";

// Salão of the demo hamburgueria (prisma/seed-demo.ts): QR → pedido → Central → comanda → fechamento.
const D = "chapa27";
const P = `/api/restaurants/${D}`;
let owner: string;
let waiter: string;
let kitchen: string;
let items: { id: string; name: string; price: number; optionGroups: { id: string; options: { id: string; label: string; priceDelta: number }[] }[] }[];
const item = (name: string) => items.find((i) => i.name === name)!;
const staff = async (u: string) => (await call("POST", "/api/auth/login", { body: { email: `${u}@chapa27.example`, password: "senha123" } })).body.token as string;

/** QR codes of the demo's 30 tables: a customer orders with the code, never with the number. */
const codes: Record<number, string> = {};

before(async () => {
  [owner, waiter, kitchen] = await Promise.all([staff("dono"), staff("garcom"), staff("cozinha")]);
  items = (await call("GET", `${P}/items`)).body;
  for (let n = 1; n <= 30; n++) codes[n] = await tableCode(D, n, waiter);
});

describe("QR da mesa", () => {
  test("Gerar novo QR: só Dono e Administrador; o código antigo para de valer na hora, para abrir e para pedir", async () => {
    const gerente = await staff("gerente");
    const old = codes[21];
    const regen = (token: string, table = 21) => call("POST", `${P}/tables/${table}/qr`, { token });
    assert.equal((await regen(waiter)).status, 403, "garçom");
    assert.equal((await regen(kitchen)).status, 403, "cozinha");
    assert.equal((await regen(owner, 99)).status, 404, "mesa que não existe");

    const byManager = await regen(gerente);
    assert.equal(byManager.status, 200);
    const fresh = byManager.body.tableCode as string;
    assert.match(fresh, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(fresh, old);
    assert.equal((await call("GET", `/api/tables/${old}`)).status, 404, "a folha impressa antes não abre mais o cardápio");
    const kids = { itemId: item("Kids").id, quantity: 1, notes: "", selectedOptions: [] };
    assert.equal((await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: D, tableCode: old, lines: [kids] } })).status, 404, "nem pede");
    assert.deepEqual((await call("GET", `/api/tables/${fresh}`)).body, { restaurantId: D, tableNumber: 21 });
    assert.equal((await call("GET", `${P}/tables/21/qr`, { token: waiter })).body.tableCode, fresh, "o QR da mesa agora é o novo");

    const byOwner = await regen(owner);
    assert.equal(byOwner.status, 200);
    assert.notEqual(byOwner.body.tableCode, fresh);
    codes[21] = byOwner.body.tableCode;
  });

  test("cada mesa tem o seu código, aleatório (base64url de 43 caracteres), que abre o restaurante dela", async () => {
    const all = Object.values(codes);
    assert.ok(all.every((c) => /^[A-Za-z0-9_-]{43}$/.test(c)), all.find((c) => !/^[A-Za-z0-9_-]{43}$/.test(c)));
    assert.equal(new Set(all).size, 30, "30 mesas, 30 códigos diferentes");
    assert.deepEqual((await call("GET", `/api/tables/${codes[12]}`)).body, { restaurantId: D, tableNumber: 12 });
  });

  test("o número da mesa não vale mais como código, nem para abrir o cardápio nem para pedir", async () => {
    for (const guess of ["chapa27.12", "12", codes[12].slice(0, 42), codes[12].toLowerCase()]) {
      if (guess === codes[12]) continue;
      assert.equal((await call("GET", `/api/tables/${encodeURIComponent(guess)}`)).status, 404, guess);
    }
    const line = { itemId: item("Kids").id, quantity: 1, notes: "", selectedOptions: [] };
    const byNumber = await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: D, tableNumber: 12, lines: [line] } });
    assert.deepEqual([byNumber.status, byNumber.body.error], [404, "Mesa não encontrada. Leia o QR da mesa de novo ou chame um atendente."]);
    const otherRestaurant = await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: "fogo", tableCode: codes[12], lines: [line] } });
    assert.equal(otherRestaurant.status, 404, "código de uma mesa do Chapa 27 num pedido de outro restaurante");
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
    const dono = await firstLogin(email, r.ownerPassword);
    await call("POST", `/api/restaurants/${r.id}/tables`, { token: dono, body: { seats: 2 } });
    const code = await tableCode(r.id, 1, dono);
    assert.equal((await call("GET", `/api/tables/${code}`)).status, 200);
    await status("inativo");
    assert.equal((await call("GET", `/api/tables/${code}`)).status, 404, "restaurante inativo");
  });
});

/** A guest order at a table of the demo restaurant. At a free table the first one waits for acceptance: these tests are about
 *  the open comanda, so staff accept it (pass accept: false to see it waiting). */
const order = async (table: number, lines: { name: string; qty?: number; options?: string[]; notes?: string }[], session = crypto.randomUUID(), { accept = true } = {}) => {
  const res = await call("POST", "/api/orders", {
    session,
    body: {
      mode: "table",
      restaurantId: D,
      tableCode: codes[table],
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
  return accept ? accepted(res, waiter) : res;
};
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
    const started = Date.now() - 1000; // order codes are 4 random digits: only this test's movements count
    await order(18, [{ name: "Chope Pilsen 300 ml", qty: 2 }]);
    const ids = (await comanda(18)).orderIds;
    const results = await Promise.all([close(18, { orderIds: ids }), close(18, { orderIds: ids }), close(18)]);
    assert.deepEqual(results.map((r) => r.body.closed).sort(), [0, 0, 1]);
    const out = (await call("GET", `${P}/stock-movements`, { token: owner })).body.filter((m: { productName: string; source: string; createdAt: string }) => m.productName === "Chope pilsen (barril)" && m.source === `Fechamento de comanda ${results.find((r) => r.body.closed)!.body.code}` && Date.parse(m.createdAt) > started);
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
    const entry = (await receivables()).find((e) => e.description === `Mesa 21 · comanda ${res.body.code}`)!;
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
      assert.equal((await receivables()).find((e) => e.description === `Mesa 22 · comanda ${res.body.code}`)!.amount, 65.8);
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
    assert.equal((await receivables()).filter((e) => e.description === `Mesa 23 · comanda ${code}`).length, 1);
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
    assert.equal((await receivables()).some((e) => e.description === `Mesa 24 · comanda ${res.body.code}`), false);
  });
});

describe("horário de pico", () => {
  test("10 mesas fecham ao mesmo tempo com os mesmos insumos: todas fecham, estoque e recebíveis certos (sem deadlock)", async () => {
    const tables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    await fresh(...tables);
    const brioche = async () => ((await call("GET", `${P}/products`, { token: owner })).body as { name: string; stock: number }[]).find((p) => p.name === "Pão brioche")!.stock;
    // Opposite item orders on alternate tables: each close then touches the shared insumos in a different order.
    const lines = [{ name: "Clássico" }, { name: "Cheddar & Bacon" }, { name: "Batata com Cheddar e Bacon" }, { name: "Onion Rings" }];
    for (const t of tables) await order(t, t % 2 ? lines : [...lines].reverse());
    const before = await brioche();
    const ids = async () => ((await call("GET", `${P}/finance-entries?kind=receivable`, { token: owner })).body as { id: string }[]).map((e) => e.id);
    const known = new Set(await ids());
    const results = await Promise.all(tables.map((t) => close(t, { paymentMethod: "Cartão" })));
    assert.deepEqual(results.map((r) => [r.status, r.body.closed]), tables.map(() => [200, 1]));
    assert.equal(Math.round((before - (await brioche())) * 1000) / 1000, 20);
    assert.equal((await ids()).filter((id) => !known.has(id)).length, 10, "um recebível por mesa");
  });
});

describe("pedido pelo QR: validações", () => {
  const post = (body: object, session = crypto.randomUUID()) => call("POST", "/api/orders", { session, body: { mode: "table", restaurantId: D, tableCode: codes[30], ...body } });
  const line = (name: string, over: object = {}) => ({ itemId: item(name).id, quantity: 1, notes: "", selectedOptions: [], ...over });

  test("observação de 300 e nome de 120 caracteres passam; um a mais, não; carrinho vazio e item de outro restaurante, não", async () => {
    await fresh(30);
    assert.equal((await post({ guestName: "Á".repeat(120), lines: [line("Kids", { notes: "ç".repeat(300) })] })).status, 201);
    assert.equal((await post({ lines: [line("Kids", { notes: "x".repeat(301) })] })).status, 400);
    assert.equal((await post({ guestName: "x".repeat(121), lines: [line("Kids")] })).status, 400);
    assert.equal((await post({ lines: [] })).status, 400);
    assert.equal((await post({ lines: [{ itemId: "fogo-burger", quantity: 1, notes: "", selectedOptions: [] }] })).status, 400);
    assert.equal((await post({ lines: [line("Kids", { selectedOptions: [{ groupId: "ponto", optionId: "ponto-9" }] })] })).status, 400, "opção que não existe");
  });

  test("o servidor recalcula o preço (valor adulterado não vale) e arredonda quantidades estranhas", async () => {
    const tampered = await post({ lines: [line("Cheddar & Bacon", { quantity: 2.7, selectedOptions: [{ groupId: "extra", optionId: "extra-0", priceDelta: -30, label: "grátis" }] })] });
    assert.equal(tampered.body.total, 89.8, "2 × (38,90 + 6,00)");
    assert.equal(tampered.body.lines[0].quantity, 2);
    const odd = await post({ lines: [line("Kids", { quantity: 0 }), line("Salada", { quantity: -3 })] });
    assert.deepEqual(odd.body.lines.map((l: { quantity: number }) => l.quantity), [1, 1]);
  });

  test("rodadas do mesmo aparelho, duas pessoas na mesma mesa e chamar garçom", async () => {
    await fresh(29);
    const phone = crypto.randomUUID();
    const first = await order(29, [{ name: "Kids" }], phone);
    const second = await order(29, [{ name: "Chope Pilsen 300 ml" }], phone);
    const otherPhone = crypto.randomUUID();
    const other = await order(29, [{ name: "Salada" }], otherPhone); // another guest at the same table
    assert.deepEqual([first.body.round, second.body.round, other.body.round], [1, 2, 1]);
    assert.deepEqual((await comanda(29)).orderIds.sort(), [first.body.id, second.body.id, other.body.id].sort());
    assert.equal((await call("POST", `/api/orders/${other.body.id}/call-waiter`, { session: otherPhone })).status, 200);
    const calls = (await call("GET", `${P}/waiter-calls`, { token: waiter })).body;
    assert.ok(calls.some((c: { tableNumber: number }) => c.tableNumber === 29));
  });

  test("chamar o garçom por um pedido: só o aparelho que fez o pedido; qualquer outro recebe 404 e ninguém é chamado", async () => {
    await fresh(29);
    const phone = crypto.randomUUID();
    const o = (await order(29, [{ name: "Kids" }], phone)).body;
    const callsAt29 = async () => ((await call("GET", `${P}/waiter-calls`, { token: waiter })).body as { tableNumber: number }[]).filter((c) => c.tableNumber === 29).length;
    const before = await callsAt29();
    for (const session of [undefined, crypto.randomUUID(), "anonymous"]) {
      assert.equal((await call("POST", `/api/orders/${o.id}/call-waiter`, { session })).status, 404, JSON.stringify(session));
    }
    assert.equal(await callsAt29(), before, "nenhum chamado criado por quem não fez o pedido");
    assert.equal((await call("POST", `/api/orders/${o.id}/call-waiter`, { session: phone })).status, 200);
    assert.equal(await callsAt29(), before + 1);
  });

  test("status da mesa: livre → ocupada → aguardando pagamento → livre; pedido recusado sai da comanda", async () => {
    await fresh(28);
    assert.equal(await tableStatus(28), "free");
    const a = (await order(28, [{ name: "Kids" }])).body;
    const b = (await order(28, [{ name: "Salada" }])).body;
    assert.equal(await tableStatus(28), "occupied");
    await call("POST", `/api/orders/${b.id}/reject`, { token: kitchen });
    assert.deepEqual((await comanda(28)).orderIds, [a.id]);
    await call("PATCH", `/api/orders/${a.id}/stage`, { token: kitchen, body: { stage: "served" } });
    assert.equal(await tableStatus(28), "awaiting_payment");
    await close(28);
    assert.equal(await tableStatus(28), "free");
  });

  test("dois aparelhos aceitam o mesmo pedido ao mesmo tempo: um aceita, o outro recebe 409", async () => {
    await fresh(27);
    const o = (await order(27, [{ name: "Kids" }])).body;
    const both = await Promise.all([call("POST", `/api/orders/${o.id}/accept`, { token: kitchen }), call("POST", `/api/orders/${o.id}/accept`, { token: waiter })]);
    assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
  });
});

test("aceitar e recusar o mesmo pedido ao mesmo tempo: só um vale (antes a cozinha preparava um pedido cancelado, fora da conta)", async () => {
  await fresh(26);
  const o = (await order(26, [{ name: "Kids" }])).body;
  const both = await Promise.all([call("POST", `/api/orders/${o.id}/accept`, { token: kitchen }), call("POST", `/api/orders/${o.id}/reject`, { token: waiter })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
  const status = (await call("GET", `${P}/orders`, { token: owner })).body.find((x: { id: string }) => x.id === o.id).status;
  assert.equal((await comanda(26)).orderIds.includes(o.id), status !== "cancelled", "na comanda se e só se não foi recusado");
});

test("repetir pedido não é mais rota da API (A-03): o app do cliente monta o carrinho com o cardápio de hoje", async () => {
  const o = (await order(30, [{ name: "Kids" }])).body;
  const res = await call("POST", `/api/orders/${o.id}/repeat`, { session: crypto.randomUUID() });
  assert.deepEqual([res.status, res.body.error], [404, `no route for POST /api/orders/${o.id}/repeat`]);
});

describe("primeiro pedido pelo QR numa mesa livre: aguarda aceite", () => {
  const openedAt = async (n: number) => (await call("GET", `${P}/tables`, { token: waiter })).body.find((t: { number: number }) => t.number === n).openedAt;
  const revenue = async () => (await call("GET", `${P}/analytics?period=today`, { token: owner })).body.kpis;
  const statusFor = async (id: string, session: string) => (await call("GET", `/api/orders/${id}`, { session })).body.status;

  test("mesa livre + aceitar: o pedido espera sem abrir a mesa nem gerar valor; aceitar abre a mesa e ele vira pedido de QR (Recebido)", async () => {
    await fresh(23);
    const before = await revenue();
    const phone = crypto.randomUUID();
    const o = (await order(23, [{ name: "Kids" }], phone, { accept: false })).body;
    assert.equal(o.status, "awaiting");
    assert.deepEqual([await tableStatus(23), await openedAt(23), (await comanda(23)).orderIds], ["free", null, []], "não abre a mesa, não entra na comanda");
    assert.deepEqual(await revenue(), before, "relatórios não contam o pedido que espera");
    assert.equal((await call("PATCH", `/api/orders/${o.id}/stage`, { token: kitchen, body: { stage: "preparing" } })).status, 409, "não pula o aceite");
    assert.ok((await call("GET", `${P}/orders`, { token: kitchen })).body.some((x: { id: string; status: string }) => x.id === o.id && x.status === "awaiting"), "a Central vê o pedido esperando");

    const ok = await call("POST", `/api/orders/${o.id}/accept`, { token: kitchen });
    assert.deepEqual([ok.status, ok.body.status], [200, "pending"]);
    assert.equal(await statusFor(o.id, phone), "pending");
    assert.equal(await tableStatus(23), "occupied");
    assert.ok(await openedAt(23), "aceitar abre a mesa");
    assert.deepEqual((await comanda(23)).orderIds, [o.id]);
    assert.equal((await call("POST", `/api/orders/${o.id}/accept`, { token: kitchen })).body.status, "preparing", "daí segue como qualquer pedido de QR");
  });

  test("mesa aberta: os pedidos seguintes do QR entram direto na comanda, sem esperar", async () => {
    // Table 23 was opened by the previous test.
    const next = (await order(23, [{ name: "Salada" }], crypto.randomUUID(), { accept: false })).body;
    assert.equal(next.status, "pending");
    assert.ok((await comanda(23)).orderIds.includes(next.id));
    await close(23);
  });

  test("mesa livre + recusar: o pedido fica recusado, a mesa continua livre e nada entra na conta", async () => {
    await fresh(24);
    const phone = crypto.randomUUID();
    const o = (await order(24, [{ name: "Kids" }], phone, { accept: false })).body;
    assert.equal(o.status, "awaiting");
    assert.equal((await call("POST", `/api/orders/${o.id}/reject`, { token: waiter })).status, 200);
    assert.equal(await statusFor(o.id, phone), "cancelled", "o cliente vê que não foi confirmado");
    assert.deepEqual([await tableStatus(24), await openedAt(24), (await comanda(24)).orderIds], ["free", null, []]);
    assert.equal((await call("POST", `/api/orders/${o.id}/accept`, { token: kitchen })).status, 409, "recusado não se aceita depois");
  });

  test("pedido lançado pelo garçom numa mesa livre entra direto em Preparando e abre a mesa", async () => {
    await fresh(24);
    const res = await call("POST", `${P}/tables/24/orders`, { token: waiter, body: { lines: [{ itemId: item("Kids").id, quantity: 1, notes: "", selectedOptions: [] }] } });
    assert.deepEqual([res.status, res.body.status], [201, "preparing"]);
    assert.equal(await tableStatus(24), "occupied");
    assert.deepEqual((await comanda(24)).orderIds, [res.body.id]);
    await close(24);
  });
});
