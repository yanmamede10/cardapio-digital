import assert from "node:assert/strict";
import { before, test } from "node:test";
import { call, uid } from "./helpers.ts";

// Cardápio of the demo hamburgueria (prisma/seed-demo.ts).
const D = "chapa27";
const P = `/api/restaurants/${D}`;
type Item = { id: string; name: string; price: number; soldOut: boolean; shortDescription: string; optionGroups: { id: string; label: string; options: { id: string; label: string; priceDelta: number; productId?: string; quantity?: number }[] }[] };
const tokens: Record<string, string> = {};
const items = async () => (await call("GET", `${P}/items`)).body as Item[];
const byName = async (n: string) => (await items()).find((i) => i.name === n)!;

before(async () => {
  for (const u of ["dono", "gerente", "garcom", "cozinha"]) tokens[u] = (await call("POST", "/api/auth/login", { body: { email: `${u}@chapa27.example`, password: "senha123" } })).body.token;
});

test("cozinha e garçom marcam Esgotado/Disponível; o cliente não consegue pedir o esgotado", async () => {
  const batata = await byName("Batata Frita");
  const soldOut = (who: string, v: unknown) => call("PATCH", `${P}/items/${batata.id}/sold-out`, { token: tokens[who], body: { soldOut: v } });
  assert.equal((await soldOut("cozinha", true)).body.soldOut, true);
  const orderIt = () => call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: D, tableNumber: 25, lines: [{ itemId: batata.id, quantity: 1, notes: "", selectedOptions: [] }] } });
  const refused = await orderIt();
  assert.equal(refused.status, 400);
  assert.match(refused.body.error, /esgotado/);
  assert.equal((await soldOut("garcom", false)).body.soldOut, false);
  assert.equal((await orderIt()).status, 201);
  assert.equal((await soldOut("garcom", "sim")).status, 400);
  assert.equal((await call("PATCH", `${P}/items/fogo-burger/sold-out`, { token: tokens.garcom, body: { soldOut: true } })).status, 404, "prato de outro restaurante");
});

test("Funcionário não edita o resto do prato", async () => {
  const kids = await byName("Kids");
  for (const who of ["garcom", "cozinha"]) {
    assert.equal((await call("PATCH", `${P}/items/${kids.id}`, { token: tokens[who], body: { shortDescription: "x" } })).status, 403, who);
    assert.equal((await call("DELETE", `${P}/items/${kids.id}`, { token: tokens[who] })).status, 403, who);
  }
});

test("Organizar prato mexe só nos adicionais: o Ponto da carne continua, e o adicional novo vale no pedido", async () => {
  const classico = await byName("Clássico");
  // As the screen sends them: every adicional with its stock link, plus a new one without.
  const extras = [...classico.optionGroups.find((g) => g.id === "extra")!.options.map((o) => ({ name: o.label, priceDelta: o.priceDelta, productId: o.productId, quantity: o.quantity })), { name: "Cheddar cremoso", priceDelta: 5 }];
  const res = await call("PATCH", `${P}/items/${classico.id}`, { token: tokens.gerente, body: { categoryId: `${D}-cat-0`, shortDescription: "Blend 150 g, cheddar, salada e molho — pão brioche tostado", extras } });
  assert.equal(res.status, 200);
  const after = await byName("Clássico");
  assert.deepEqual(after.optionGroups.map((g) => g.label), ["Ponto da carne", "Adicionais"]);
  assert.equal(after.optionGroups[0].options.length, 3);
  const cremoso = after.optionGroups[1].options.find((o) => o.label === "Cheddar cremoso")!;
  const order = await call("POST", "/api/orders", {
    session: crypto.randomUUID(),
    body: { mode: "table", restaurantId: D, tableNumber: 26, lines: [{ itemId: after.id, quantity: 1, notes: "", selectedOptions: [{ groupId: "ponto", optionId: "ponto-1" }, { groupId: "extra", optionId: cremoso.id }] }] }
  });
  assert.equal(order.body.total, 37.9, "32,90 + 5,00");
  assert.deepEqual(order.body.lines[0].selectedOptions.map((o: { label: string }) => o.label), ["Bem passado", "Cheddar cremoso"]);
});

test("textos: acento aceito, acima do limite recusado", async () => {
  const salada = await byName("Salada");
  const patch = (body: object) => call("PATCH", `${P}/items/${salada.id}`, { token: tokens.gerente, body });
  assert.equal((await patch({ shortDescription: "Alface, tomate, cebola roxa e maionese de açafrão — pão de fermentação natural" })).status, 200);
  assert.equal((await patch({ shortDescription: "x".repeat(201) })).status, 400);
  assert.equal((await byName("Salada")).shortDescription.includes("açafrão"), true);
});

test("categorias: criar, renomear e excluir (só vazia); nome único sem diferenciar maiúsculas", async () => {
  const cats = (r: { body: { id: string; name: string }[] }) => r.body.map((c) => c.name);
  const created = await call("POST", `${P}/categories`, { token: tokens.gerente, body: { name: "  Combos da Casa  " } });
  assert.equal(created.status, 201);
  assert.equal(cats(created).at(-1), "Combos da Casa", "entra no fim, sem os espaços");
  const combos = created.body.at(-1).id;
  assert.equal((await call("POST", `${P}/categories`, { token: tokens.gerente, body: { name: "combos da casa" } })).status, 409);
  for (const name of ["", "   ", "x".repeat(41)]) assert.equal((await call("POST", `${P}/categories`, { token: tokens.gerente, body: { name } })).status, 400, JSON.stringify(name));
  assert.equal((await call("PATCH", `${P}/categories/${combos}`, { token: tokens.gerente, body: { name: "Hambúrgueres" } })).status, 409, "nome de outra");
  const renamed = await call("PATCH", `${P}/categories/${combos}`, { token: tokens.gerente, body: { name: "Combos & Promoções" } });
  assert.ok(cats(renamed).includes("Combos & Promoções"));
  assert.equal((await call("DELETE", `${P}/categories/${D}-cat-0`, { token: tokens.gerente })).status, 409, "Hambúrgueres tem pratos");
  assert.equal((await call("DELETE", `${P}/categories/fogo-cat-0`, { token: tokens.gerente })).status, 404, "de outro restaurante");
  for (const who of ["garcom", "cozinha"]) assert.equal((await call("POST", `${P}/categories`, { token: tokens[who], body: { name: "X" } })).status, 403, who);
  assert.equal((await call("PATCH", `${P}/items/${(await byName("Kids")).id}`, { token: tokens.gerente, body: { categoryId: "fogo-cat-0" } })).status, 400, "prato não vai para categoria alheia");
  const deleted = await call("DELETE", `${P}/categories/${combos}`, { token: tokens.gerente });
  assert.equal(cats(deleted).includes("Combos & Promoções"), false);
});

test("adicional com ficha técnica: o Bacon extra baixa bacon ao fechar a conta; vínculo inválido é recusado", async () => {
  const P2 = P;
  const products = (await call("GET", `${P2}/products`, { token: tokens.dono })).body as { id: string; name: string; stock: number; composed: boolean }[];
  const bacon = products.find((p) => p.name === "Bacon em fatias")!;
  const composed = products.find((p) => p.composed)!;
  const classico = await byName("Clássico");
  const extras = classico.optionGroups.find((g) => g.id === "extra")!.options.map((o) => ({ name: o.label, priceDelta: o.priceDelta, productId: (o as { productId?: string }).productId, quantity: (o as { quantity?: number }).quantity }));
  for (const bad of [{ productId: composed.id, quantity: 1 }, { productId: "nao-existe", quantity: 1 }, { productId: bacon.id, quantity: 0 }]) {
    const res = await call("PATCH", `${P2}/items/${classico.id}`, { token: tokens.gerente, body: { extras: [{ ...extras[0], ...bad }] } });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }

  await call("POST", `${P2}/tables/12/close`, { token: tokens.garcom });
  const baconExtra = classico.optionGroups.find((g) => g.id === "extra")!.options.find((o) => o.label === "Bacon extra")!;
  await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: D, tableNumber: 12, lines: [{ itemId: classico.id, quantity: 2, notes: "", selectedOptions: [{ groupId: "extra", optionId: baconExtra.id }] }] } });
  const before = bacon.stock;
  await call("POST", `${P2}/tables/12/close`, { token: tokens.garcom });
  const after = ((await call("GET", `${P2}/products`, { token: tokens.dono })).body as { id: string; stock: number }[]).find((p) => p.id === bacon.id)!.stock;
  assert.equal(Math.round((before - after) * 1000) / 1000, 0.06, "2 × 0,03 kg — o Clássico sozinho não leva bacon");
});
