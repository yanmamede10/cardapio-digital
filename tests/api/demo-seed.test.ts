import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { ADMIN_KEY, call } from "./helpers.ts";

// tests/run.mjs runs prisma/seed-demo.ts on the empty database first (it must work alone — it's the production seed),
// and again after the dev seed wiped everything.
const D = "chapa27";
const login = async (email: string) => (await call("POST", "/api/auth/login", { body: { email, password: "senha123" } })).body;

test("seed de demonstração: hamburgueria com cardápio, ficha técnica, estoque, mesas no mapa, contas do mês, equipe e mensalidade", async () => {
  const roles = await Promise.all(["dono", "gerente", "garcom", "cozinha"].map((u) => login(`${u}@chapa27.example`)));
  assert.deepEqual(roles.map((r) => r.staff.role), ["owner", "manager", "waiter", "kitchen"]);
  assert.ok(roles.every((r) => r.mustChangePassword === false));
  const token = roles[0].token;
  const P = `/api/restaurants/${D}`;

  const items = (await call("GET", `${P}/items`)).body;
  const categories = (await call("GET", `${P}/categories`)).body.map((c: { name: string }) => c.name);
  assert.deepEqual(categories, ["Hambúrgueres", "Porções", "Bebidas", "Sobremesas"]);
  assert.equal(items.length, 30);
  assert.ok(items.every((i: { imageUrl: string | null }) => i.imageUrl === null), "sem fotos de terceiros");

  const products = (await call("GET", `${P}/products`, { token })).body as { name: string; type: string; composed: boolean; cost: number; stock: number; unit: string; categoryId: string | null }[];
  const byName = (n: string) => products.find((p) => p.name === n)!;
  assert.equal(byName("Clássico").composed, true);
  assert.equal(byName("Clássico").cost, 11.71, "1,85 + 6,90 + 0,04×54,90 + 0,015×12 + 0,03×7,50 + 0,02×18");
  assert.ok(byName("Bacon em fatias").stock < 1 && byName("Pão australiano").stock < 10, "alguns itens perto de acabar");
  assert.ok(products.filter((p) => p.type === "insumo").every((p) => p.unit && p.cost > 0));
  // Item 6: every insumo is born in a category; the insumos' own come after the menu's (other test files add theirs after).
  const all = (await call("GET", `${P}/categories/all`, { token })).body as { id: string; name: string }[];
  assert.deepEqual(all.slice(0, 10).map((c) => c.name), ["Hambúrgueres", "Porções", "Bebidas", "Sobremesas", "Carnes", "Pães", "Hortifrúti", "Laticínios", "Molhos", "Embalagens"]);
  const catOf = (n: string) => all.find((c) => c.id === byName(n).categoryId)?.name;
  // Other test files add items to the Chapa 27 (one goes to Sem categoria on purpose): the seed's 33 insumos all have one.
  assert.ok(products.filter((p) => p.type === "insumo" && p.categoryId).length >= 33, "os insumos do seed nascem com categoria");
  assert.deepEqual(["Blend bovino 150 g", "Pão brioche", "Alface americana", "Queijo cheddar fatiado", "Chope pilsen (barril)", "Caixa de hambúrguer para viagem", "Molho barbecue", "Brownie"].map(catOf), ["Carnes", "Pães", "Hortifrúti", "Laticínios", "Bebidas", "Embalagens", "Molhos", "Sobremesas"]);

  const grid = (await call("GET", `${P}/salon-grid`, { token })).body;
  assert.equal(grid.tables.length, 30);
  assert.ok(grid.tables.every((t: { gridRow: number | null; gridCol: number | null }) => t.gridRow !== null && t.gridCol !== null && t.gridRow < grid.gridSize && t.gridCol < grid.gridSize));

  const entries = (await call("GET", `${P}/finance-entries`, { token })).body as { kind: string; dueDate: string }[];
  const month = new Date().toLocaleDateString("sv-SE").slice(0, 7);
  assert.ok(entries.some((e) => e.kind === "payable") && entries.some((e) => e.kind === "receivable") && entries.every((e) => e.dueDate.startsWith(month)));

  const admin = (await call("GET", `/api/admin/restaurants/${D}`, { token: ADMIN_KEY })).body;
  assert.equal(admin.modules.includes("fiscal"), false, "Emissão Fiscal desligada");
  assert.equal(admin.modules.includes("delivery"), false, "Delivery desligado (F-6)");
  assert.ok(!(await call("GET", "/api/restaurants/")).body.some((r: { id: string }) => r.id === D), "fora da lista do app do cliente");
  assert.deepEqual([admin.status, admin.planPrice, admin.planDueDay], ["ativo", 299.9, 10]);
});

test("o seed de dev (apaga tudo, senha123) se recusa a rodar com NODE_ENV=production, e o banco fica como estava", async () => {
  const before = (await call("GET", `/api/restaurants/${D}/items`)).body.length;
  // JWT_SECRET: in production the API's auth module refuses to load without one, before seed.ts gets to say anything.
  const r = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { cwd: "apps/api", env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "x".repeat(32) }, encoding: "utf8", timeout: 60_000 });
  assert.equal(r.status, 1, r.stdout);
  assert.ok(r.stderr.includes("Recusado: o seed de dev (prisma/seed.ts) apaga o banco"), r.stderr);
  assert.equal((await call("GET", `/api/restaurants/${D}/items`)).body.length, before, "o Chapa 27 continua lá (o seed de dev o apagaria)");
});
