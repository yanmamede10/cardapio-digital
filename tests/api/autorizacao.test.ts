import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../../apps/api/src/app.ts";
import { ADMIN_KEY, ALL_MODULES, R, SEED_MODULES, call, login, setModules } from "./helpers.ts";
import { ROUTES } from "./rotas.mjs";
import { render } from "../../scripts/gerar-permissoes.ts";

// E-1: every route registered in Express, walked from the app itself. A route has to be in tests/api/rotas.mjs (the one list:
// the permission matrix docs/seguranca/permissoes.md and scripts/conferir-permissoes.mjs read it too) or this test fails — a
// new route can't ship without saying who may call it. For each protected route: no credential → 401; a staff token of
// another restaurant → 403/404; every role below the minimum → 403; its module off → 403.

type Min = "funcionario" | "garcom" | "administrador" | "dono";
type Rule = [min: Min, module: string | null];
const of = (access: string) => ROUTES.filter(([, r]) => r.access === access).map(([route]) => route);
/** Anyone, no token: the customer app (menu, QR, orders by device id) and the login itself. */
const PUBLIC = of("public");
/** Evolution → API: its shared secret header, not a token. */
const WEBHOOK = of("webhook");
/** The caller's own login (any role, provisional password included): nothing of another restaurant to reach. */
const SELF = of("self");
/** Any staff role, no :id to swap: the token's restaurant decides what comes back (G-1: the addresses of its orders). */
const OWN = of("own");
/** The super admin key (Bearer); no staff token passes. */
const SUPER_ADMIN = of("admin");
/** Staff of the restaurant: minimum role and module (docs/adr/0005-modelo-de-permissoes.md, PLAN_MODULES). */
const STAFF: Record<string, Rule> = Object.fromEntries(ROUTES.filter(([, r]) => r.access === "staff").map(([route, r]) => [route, [r.min as Min, r.module ?? null]]));

/** "METHOD /path" of every route Express has, mount point included (Express 4: the mount is only in the layer's regexp). */
function registeredRoutes(): string[] {
  type Layer = { route?: { path: string; methods: Record<string, boolean> }; name: string; regexp: RegExp; handle: { stack?: Layer[] } };
  const mount = (re: RegExp) => re.source.replace(/^\^/, "").replace(/\\\/\?\(\?=.*/, "").replace(/\\\//g, "/");
  const list = (l: Layer, prefix: string) => Object.keys(l.route!.methods).map((m) => `${m.toUpperCase()} ${prefix}${l.route!.path}`);
  return (app as unknown as { _router: { stack: Layer[] } })._router.stack.flatMap((l) =>
    l.route ? list(l, "") : l.name === "router" ? (l.handle.stack ?? []).filter((s) => s.route).flatMap((s) => list(s, mount(l.regexp))) : []
  );
}

const ROLE_TOKENS: Record<string, string> = {};
const BELOW: Record<Min, string[]> = { funcionario: [], garcom: ["kitchen"], administrador: ["waiter", "kitchen"], dono: ["waiter", "kitchen", "manager"] };
const MIN_ROLE: Record<Min, string> = { funcionario: "kitchen", garcom: "waiter", administrador: "manager", dono: "owner" };
let otherRestaurant: string; // the Dono of Chapa 27 (seed-demo), on fogo's routes
const params: Record<string, string> = { id: R, number: "1", tableCode: "nao-existe" };

before(async () => {
  [ROLE_TOKENS.owner, ROLE_TOKENS.manager, ROLE_TOKENS.waiter, ROLE_TOKENS.kitchen, otherRestaurant] = await Promise.all([
    login(),
    login("bruno@fogoeno.com.br"),
    login("paula@fogoeno.com.br"),
    login("igor@fogoeno.com.br"),
    login("dono@chapa27.example")
  ]);
  // Real ids where the restaurant is checked after loading the record: an order of fogo, a finance entry of fogo.
  const item = (await call("GET", `/api/restaurants/${R}/items`)).body.find((i: { soldOut: boolean }) => !i.soldOut);
  params.orderId = (await call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "delivery", restaurantId: R, lines: [{ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] }] } })).body.id;
  params.entryId = (await call("POST", `/api/restaurants/${R}/finance-entries`, { token: ROLE_TOKENS.owner, body: { kind: "payable", description: "Autorização", amount: 1, dueDate: "2026-10-01", status: "pending" } })).body.id;
  assert.ok(params.orderId && params.entryId);
});
after(() => setModules(SEED_MODULES));

/** The route with its params filled: :id is fogo (an order's id under /api/orders), anything else a real id or a dummy. */
const fill = (route: string) => {
  const [method, path] = route.split(" ");
  const url = path.replace(/:(\w+)/g, (_, p: string) => (p === "id" && path.startsWith("/api/orders") ? params.orderId : params[p] ?? "nao-existe"));
  return { method, url };
};
// Enough of a body to get past validation to the check that matters: the order's restaurant, the finance entry's module.
const BODY: Record<string, unknown> = {
  "PATCH /api/orders/:id/stage": { stage: "ready" },
  "POST /api/restaurants/:id/finance-entries": { kind: "payable" },
  "POST /api/restaurants/:id/finance-entries/:entryId/pay": { paidOn: "2026-10-01", paymentMethod: "PIX" }
};
const send = (route: string, token?: string) => {
  const { method, url } = fill(route);
  return call(method, url, { token, body: method === "GET" ? undefined : BODY[route] ?? {} });
};

test("toda rota registrada está numa lista do teste (pública, webhook, própria, super admin ou equipe com papel e módulo)", () => {
  const known = [...PUBLIC, ...WEBHOOK, ...SELF, ...OWN, ...SUPER_ADMIN, ...Object.keys(STAFF)];
  const routes = registeredRoutes();
  assert.ok(routes.length >= 100, `só ${routes.length} rotas encontradas`);
  assert.deepEqual(routes.filter((r) => !known.includes(r)), [], "rota nova: diga quem pode chamá-la neste teste");
  assert.deepEqual(known.filter((r) => !routes.includes(r)), [], "rota que não existe mais");
});

test("sem credencial: 401 em toda rota que não é pública; as públicas respondem sem token", async () => {
  const wrong: string[] = [];
  for (const route of [...WEBHOOK, ...SELF, ...OWN, ...SUPER_ADMIN, ...Object.keys(STAFF)]) {
    const { status } = await send(route);
    if (status !== 401) wrong.push(`${route} → ${status}`);
  }
  for (const route of PUBLIC) {
    const { status } = await send(route);
    if (status === 401 || status === 403 || status >= 500) wrong.push(`${route} (pública) → ${status}`);
  }
  assert.deepEqual(wrong, []);
});

test("G-1 (SEG-09): endereços só para a equipe, e só os dos pedidos do próprio restaurante", async () => {
  assert.equal((await call("GET", "/api/addresses")).status, 401);
  // fogo's delivery orders (seed) went to Casa and Trabalho; the Chapa 27 (no delivery) has none of its own.
  const fogo = await call("GET", "/api/addresses", { token: ROLE_TOKENS.kitchen });
  assert.equal(fogo.status, 200);
  assert.deepEqual(fogo.body.map((a: { id: string }) => a.id).sort(), ["addr-casa", "addr-trabalho"]);
  const chapa = await call("GET", "/api/addresses", { token: otherRestaurant });
  assert.equal(chapa.status, 200);
  assert.deepEqual(chapa.body, [], "a equipe da Chapa 27 não vê os endereços dos pedidos do fogo");
});

test("token de staff não passa nas rotas do super admin", async () => {
  const wrong: string[] = [];
  for (const route of SUPER_ADMIN) {
    const { status } = await send(route, ROLE_TOKENS.owner);
    if (status !== 401) wrong.push(`${route} → ${status}`);
  }
  assert.deepEqual(wrong, []);
});

test("token de outro restaurante: 403 ou 404 em toda rota da equipe", async () => {
  const wrong: string[] = [];
  for (const route of Object.keys(STAFF)) {
    const { status } = await send(route, otherRestaurant);
    if (status !== 403 && status !== 404) wrong.push(`${route} → ${status}`);
  }
  assert.deepEqual(wrong, []);
});

test("papel abaixo do mínimo: 403; o papel mínimo passa (leituras)", async () => {
  await setModules(ALL_MODULES); // only the role decides here
  const wrong: string[] = [];
  for (const [route, [min]] of Object.entries(STAFF)) {
    for (const role of BELOW[min]) {
      const { status } = await send(route, ROLE_TOKENS[role]);
      if (status !== 403) wrong.push(`${route} com ${role} → ${status}`);
    }
    if (route.startsWith("GET ")) {
      const { status } = await send(route, ROLE_TOKENS[MIN_ROLE[min]]);
      if (status === 401 || status === 403 || status >= 500) wrong.push(`${route} com ${MIN_ROLE[min]} (mínimo) → ${status}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test("módulo desligado: 403 em toda rota do módulo, mesmo para o Dono", async () => {
  await setModules([]);
  const wrong: string[] = [];
  for (const [route, [, module]] of Object.entries(STAFF)) {
    if (!module) continue;
    const { status } = await send(route, ROLE_TOKENS.owner);
    if (status !== 403) wrong.push(`${route} (${module}) → ${status}`);
  }
  await setModules(SEED_MODULES);
  assert.deepEqual(wrong, []);
});

// Item 8: the matrix is generated, never edited by hand — this fails when someone changes rotas.mjs (or who sees a screen)
// without running npx tsx scripts/gerar-permissoes.ts.
test("docs/seguranca/permissoes.md é o que scripts/gerar-permissoes.ts gera da lista de rotas", async () => {
  const { readFileSync } = await import("node:fs");
  const doc = readFileSync(new URL("../../docs/seguranca/permissoes.md", import.meta.url), "utf8").replaceAll("\r\n", "\n");
  assert.equal(doc, render(), "rode: npx tsx scripts/gerar-permissoes.ts");
  assert.equal(new Set(ROUTES.map(([route]) => route)).size, ROUTES.length, "rota repetida em rotas.mjs");
});

test("credencial do super admin só vale com a chave inteira", async () => {
  assert.equal((await call("GET", "/api/admin/restaurants", { token: ADMIN_KEY })).status, 200);
  for (const token of [ADMIN_KEY.slice(0, -1), `${ADMIN_KEY}x`, ""]) assert.equal((await call("GET", "/api/admin/restaurants", { token })).status, 401, JSON.stringify(token));
});
