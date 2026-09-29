import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { R, call, login, product, uid } from "./helpers.ts";

let token: string;
const P = `/api/restaurants/${R}`;
const stockOf = async (id: string) => (await call("GET", `${P}/products`, { token })).body.find((p: { id: string }) => p.id === id);

/** Pão (un, R$2) + Blend (kg, R$40) → Burger = 1 pão + 0,15 kg blend, linked to the Cardápio. */
async function burgerKit() {
  const s = uid();
  const pao = (await call("POST", `${P}/products`, { token, body: product({ name: `Pão ${s}`, cost: 2 }) })).body;
  const blend = (await call("POST", `${P}/products`, { token, body: product({ name: `Blend ${s}`, unit: "kg", cost: 40 }) })).body;
  const burger = (
    await call("POST", `${P}/products`, {
      token,
      body: product({ name: `Burger ${s}`, type: "produto", price: 30, composed: true, components: [{ componentId: pao.id, quantity: 1 }, { componentId: blend.id, quantity: 0.15 }] })
    })
  ).body;
  const item = (await call("POST", `${P}/items`, { token, body: { productId: burger.id, categoryId: `${R}-cat-1`, name: "", price: 0, shortDescription: "" } })).body;
  return { s, pao, blend, burger, item };
}

before(async () => {
  token = await login();
});

describe("catálogo e composição", () => {
  test("custo do composto = soma de quantidade × custo atual dos componentes", async () => {
    const { burger } = await burgerKit();
    assert.equal(burger.cost, 8);
    assert.equal(burger.composed, true);
  });

  test("composição é validada no servidor", async () => {
    const { burger, pao } = await burgerKit();
    const composed = (components: unknown) => product({ name: `X ${uid()}`, type: "produto", price: 1, composed: true, components });
    assert.equal((await call("POST", `${P}/products`, { token, body: composed([{ componentId: burger.id, quantity: 1 }]) })).status, 400, "composto não entra em composição");
    assert.equal((await call("POST", `${P}/products`, { token, body: composed([{ componentId: "nao-existe", quantity: 1 }]) })).status, 400, "componente desconhecido");
    assert.equal((await call("POST", `${P}/products`, { token, body: composed([{ componentId: pao.id, quantity: 0 }]) })).status, 400, "quantidade zero");
    assert.equal((await call("POST", `${P}/products`, { token, body: product({ name: `Y ${uid()}`, composed: true, components: [{ componentId: pao.id, quantity: 1 }] }) })).status, 400, "insumo não pode ser composto");
  });

  test("produto usado como componente não pode virar composto", async () => {
    const s = uid();
    const chope = (await call("POST", `${P}/products`, { token, body: product({ name: `Chope ${s}`, type: "produto", price: 16, cost: 5 }) })).body;
    const lata = (await call("POST", `${P}/products`, { token, body: product({ name: `Lata ${s}`, cost: 1 }) })).body;
    await call("POST", `${P}/products`, { token, body: product({ name: `Combo ${s}`, type: "produto", price: 20, composed: true, components: [{ componentId: chope.id, quantity: 1 }] }) });
    const res = await call("PATCH", `${P}/products/${chope.id}`, { token, body: product({ name: chope.name, type: "produto", price: 16, composed: true, components: [{ componentId: lata.id, quantity: 1 }] }) });
    assert.equal(res.status, 409);
  });

  test("editar nome/preço no Catálogo atualiza o prato do Cardápio", async () => {
    const { burger, item } = await burgerKit();
    await call("PATCH", `${P}/products/${burger.id}`, {
      token,
      body: product({ name: `${burger.name} novo`, type: "produto", price: 32, composed: true, components: burger.components.map((c: { componentId: string; quantity: number }) => ({ componentId: c.componentId, quantity: c.quantity })) })
    });
    const dish = (await call("GET", `${P}/items`, { token })).body.find((i: { id: string }) => i.id === item.id);
    assert.equal(dish.price, 32);
    assert.equal(dish.name, `${burger.name} novo`);
  });

  test("Cardápio só vincula Produto, e uma vez só", async () => {
    const { burger, pao } = await burgerKit();
    const link = (productId: string) => call("POST", `${P}/items`, { token, body: { productId, categoryId: `${R}-cat-1`, name: "", price: 0, shortDescription: "" } });
    assert.equal((await link(burger.id)).status, 409, "já está no cardápio");
    assert.equal((await link(pao.id)).status, 400, "insumo não vai para o cardápio");
  });
});

describe("importação de XML", () => {
  test("casa por nome sem diferenciar maiúsculas, cria insumo novo e faz custo médio ponderado", async () => {
    const { pao } = await burgerKit();
    const novo = `Queijo ${uid()}`;
    const imp = (items: unknown[]) => call("POST", `${P}/stock-movements/xml`, { token, body: { fileName: "nfe_teste.xml", items } });
    assert.equal((await imp([{ name: pao.name.toUpperCase(), ncm: "", unit: "UN", quantity: 10, unitCost: 3 }, { name: novo, ncm: "0406", unit: "KG", quantity: 2, unitCost: 50 }])).status, 201);
    assert.equal((await imp([{ name: pao.name, ncm: "", unit: "UN", quantity: 10, unitCost: 5 }])).status, 201);

    const after = await stockOf(pao.id);
    assert.equal(after.stock, 20);
    assert.equal(after.cost, 4, "(10 × 3 + 10 × 5) / 20");
    const created = (await call("GET", `${P}/products`, { token })).body.find((p: { name: string }) => p.name === novo);
    assert.deepEqual([created.type, created.unit, created.stock, created.cost], ["insumo", "kg", 2, 50]);
  });

  test("rejeita itens inválidos sem gravar nada", async () => {
    const res = await call("POST", `${P}/stock-movements/xml`, { token, body: { fileName: "x.xml", items: [{ name: "Tomate", ncm: "", unit: "KG", quantity: -1, unitCost: 2 }] } });
    assert.equal(res.status, 400);
  });
});

describe("baixa de estoque", () => {
  test("fechar comanda baixa os insumos da ficha técnica, uma vez só", async () => {
    const { pao, blend, burger, item } = await burgerKit();
    const table = 100 + Math.floor(Math.random() * 800);
    const order = (await call("POST", "/api/orders", { session: `t-${uid()}`, body: { mode: "table", restaurantId: R, tableNumber: table, lines: [{ itemId: item.id, quantity: 3, notes: "", selectedOptions: [] }] } })).body;

    const comanda = (await call("GET", `${P}/tables/${table}/comanda`, { token })).body;
    assert.deepEqual(comanda.orderIds, [order.id], "o primeiro pedido abre a comanda e aparece nela");

    // Two closes at once (double click): only one may take stock.
    await Promise.all([call("POST", `${P}/tables/${table}/close`, { token }), call("POST", `${P}/tables/${table}/close`, { token })]);
    assert.equal((await stockOf(pao.id)).stock, -3);
    assert.equal((await stockOf(blend.id)).stock, -0.45);
    assert.equal((await stockOf(burger.id)).stock, 0, "composto não tem estoque próprio");

    const moves = (await call("GET", `${P}/stock-movements`, { token })).body.filter((m: { source: string }) => m.source === `Fechamento de comanda ${order.code}`);
    assert.equal(moves.length, 2);
  });

  test("produto sem composição baixa o próprio estoque", async () => {
    const chope = (await call("POST", `${P}/products`, { token, body: product({ name: `Chope ${uid()}`, type: "produto", price: 16 }) })).body;
    const item = (await call("POST", `${P}/items`, { token, body: { productId: chope.id, categoryId: `${R}-cat-4`, name: "", price: 0, shortDescription: "" } })).body;
    const table = 100 + Math.floor(Math.random() * 800);
    await call("POST", "/api/orders", { session: `t-${uid()}`, body: { mode: "table", restaurantId: R, tableNumber: table, lines: [{ itemId: item.id, quantity: 4, notes: "", selectedOptions: [] }] } });
    await call("POST", `${P}/tables/${table}/close`, { token });
    assert.equal((await stockOf(chope.id)).stock, -4);
  });

  test("delivery baixa estoque ao ser entregue, uma vez só", async () => {
    const { pao, item } = await burgerKit();
    const order = (await call("POST", "/api/orders", { session: `d-${uid()}`, body: { mode: "delivery", restaurantId: R, lines: [{ itemId: item.id, quantity: 2, notes: "", selectedOptions: [] }] } })).body;
    await Promise.all([
      call("PATCH", `/api/orders/${order.id}/stage`, { token, body: { stage: "delivered" } }),
      call("PATCH", `/api/orders/${order.id}/stage`, { token, body: { stage: "delivered" } })
    ]);
    assert.equal((await stockOf(pao.id)).stock, -2);
  });
});

test("nome de insumo com acento é aceito; acima de 80 caracteres, não", async () => {
  const ok = await call("POST", `${P}/products`, { token, body: product({ name: `Pão de açúcar ç ${uid()}` }) });
  assert.equal(ok.status, 201);
  assert.match(ok.body.name, /açúcar ç/);
  assert.equal((await call("POST", `${P}/products`, { token, body: product({ name: "x".repeat(81) }) })).status, 400);
});

describe("ajuste manual de estoque", () => {
  const adjust = (body: object, t = token) => call("POST", `${P}/stock-movements/adjust`, { token: t, body });

  test("entrada, saída e contagem: o estoque muda e cada ajuste fica em Movimentações", async () => {
    const p = (await call("POST", `${P}/products`, { token, body: product({ name: `Farinha ${uid()}`, unit: "kg", cost: 5 }) })).body;
    assert.equal((await adjust({ productId: p.id, kind: "in", quantity: 10.5, reason: "Compra sem nota" })).body.stock, 10.5);
    assert.equal((await adjust({ productId: p.id, kind: "out", quantity: 0.25, reason: "Perda" })).body.stock, 10.25);
    assert.equal((await adjust({ productId: p.id, kind: "count", quantity: 9 })).body.stock, 9, "contagem define o estoque");
    assert.equal((await adjust({ productId: p.id, kind: "count", quantity: 9 })).body.stock, 9, "contagem igual não gera movimento");
    const moves = (await call("GET", `${P}/stock-movements`, { token })).body.filter((m: { productName: string }) => m.productName === p.name);
    assert.deepEqual(moves.map((m: { kind: string; quantity: number; source: string }) => [m.kind, m.quantity, m.source]).reverse(), [
      ["in", 10.5, "Entrada manual: Compra sem nota"],
      ["out", 0.25, "Saída manual: Perda"],
      ["out", 1.25, "Contagem de estoque"]
    ]);
  });

  test("valida tipo, quantidade, produto com ficha técnica, outro restaurante e papel", async () => {
    const { burger, pao } = await burgerKit();
    for (const bad of [{ kind: "x", quantity: 1 }, { kind: "in", quantity: 0 }, { kind: "out", quantity: -1 }, { kind: "in", quantity: "3" }]) {
      assert.equal((await adjust({ productId: pao.id, ...bad })).status, 400, JSON.stringify(bad));
    }
    assert.equal((await adjust({ productId: burger.id, kind: "in", quantity: 1 })).status, 400, "composto não tem estoque próprio");
    assert.equal((await adjust({ productId: "nao-existe", kind: "in", quantity: 1 })).status, 404);
    assert.equal((await call("POST", "/api/restaurants/napoli/stock-movements/adjust", { token, body: { productId: pao.id, kind: "in", quantity: 1 } })).status, 403);
    assert.equal((await adjust({ productId: pao.id, kind: "in", quantity: 1 }, await login("paula@fogoeno.com.br"))).status, 403, "garçom");
  });
});
