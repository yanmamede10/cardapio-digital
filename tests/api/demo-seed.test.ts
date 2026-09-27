import assert from "node:assert/strict";
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

  const products = (await call("GET", `${P}/products`, { token })).body as { name: string; type: string; composed: boolean; cost: number; stock: number; unit: string }[];
  const byName = (n: string) => products.find((p) => p.name === n)!;
  assert.equal(byName("Clássico").composed, true);
  assert.equal(byName("Clássico").cost, 11.71, "1,85 + 6,90 + 0,04×54,90 + 0,015×12 + 0,03×7,50 + 0,02×18");
  assert.ok(byName("Bacon em fatias").stock < 1 && byName("Pão australiano").stock < 10, "alguns itens perto de acabar");
  assert.ok(products.filter((p) => p.type === "insumo").every((p) => p.unit && p.cost > 0));

  const grid = (await call("GET", `${P}/salon-grid`, { token })).body;
  assert.equal(grid.tables.length, 30);
  assert.ok(grid.tables.every((t: { gridRow: number | null; gridCol: number | null }) => t.gridRow !== null && t.gridCol !== null && t.gridRow < grid.gridSize && t.gridCol < grid.gridSize));

  const entries = (await call("GET", `${P}/finance-entries`, { token })).body as { kind: string; dueDate: string }[];
  const month = new Date().toLocaleDateString("sv-SE").slice(0, 7);
  assert.ok(entries.some((e) => e.kind === "payable") && entries.some((e) => e.kind === "receivable") && entries.every((e) => e.dueDate.startsWith(month)));

  const admin = (await call("GET", `/api/admin/restaurants/${D}`, { token: ADMIN_KEY })).body;
  assert.equal(admin.modules.includes("fiscal"), false, "Emissão Fiscal desligada");
  assert.deepEqual([admin.status, admin.planPrice, admin.planDueDay], ["ativo", 299.9, 10]);
});
