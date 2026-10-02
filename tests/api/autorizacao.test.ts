import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../../apps/api/src/app.ts";
import { ADMIN_KEY, ALL_MODULES, R, SEED_MODULES, call, login, setModules } from "./helpers.ts";

// E-1: every route registered in Express, walked from the app itself. A route has to be on one of the lists below or this
// test fails — a new route can't ship without saying who may call it. For each protected route: no credential → 401; a
// staff token of another restaurant → 403/404; every role below the minimum → 403; its module off → 403.

type Min = "funcionario" | "atendimento" | "administrador" | "dono";
type Rule = [min: Min, module: string | null];

/** Anyone, no token: the customer app (menu, QR, orders by device id) and the login itself. */
const PUBLIC = [
  "GET /api/health",
  "POST /api/auth/login",
  "GET /api/restaurants/",
  "GET /api/restaurants/:id",
  "GET /api/restaurants/:id/categories",
  "GET /api/restaurants/:id/items",
  "GET /api/restaurants/:id/items/:itemId",
  "GET /api/restaurants/:id/appearance",
  "GET /api/tables/:tableCode",
  "GET /api/addresses/",
  "GET /api/payment-methods/",
  "POST /api/coupons/apply",
  "POST /api/orders/",
  "GET /api/orders/",
  "GET /api/orders/:id",
  "POST /api/orders/:id/call-waiter"
];
/** Evolution → API: its shared secret header, not a token. */
const WEBHOOK = ["POST /api/whatsapp/webhook/"];
/** The caller's own login (any role, provisional password included): nothing of another restaurant to reach. */
const SELF = ["GET /api/auth/me", "POST /api/auth/password"];
/** The super admin key (Bearer); no staff token passes. */
const SUPER_ADMIN = [
  "GET /api/admin/restaurants",
  "POST /api/admin/restaurants",
  "GET /api/admin/restaurants/:id",
  "PATCH /api/admin/restaurants/:id",
  "PATCH /api/admin/restaurants/:id/status",
  "PATCH /api/admin/restaurants/:id/modules",
  "POST /api/admin/restaurants/:id/staff/:staffId/reset-password",
  "PATCH /api/admin/restaurants/:id/plan",
  "GET /api/admin/billing",
  "POST /api/admin/billing",
  "POST /api/admin/billing/:chargeId/pay"
];
/** Staff of the restaurant: minimum role and module (docs/adr/0005-modelo-de-permissoes.md, PLAN_MODULES). */
const STAFF: Record<string, Rule> = {
  "GET /api/restaurants/:id/orders": ["funcionario", "pedidos"],
  "GET /api/restaurants/:id/shift-stats": ["funcionario", "pedidos"],
  "POST /api/orders/:id/accept": ["funcionario", "pedidos"],
  "POST /api/orders/:id/reject": ["funcionario", "pedidos"],
  "PATCH /api/orders/:id/stage": ["funcionario", "pedidos"],

  "GET /api/restaurants/:id/tables": ["funcionario", "mesas"],
  "POST /api/restaurants/:id/tables": ["funcionario", "mesas"],
  "GET /api/restaurants/:id/salon-grid": ["funcionario", "mesas"],
  "PATCH /api/restaurants/:id/salon-grid": ["funcionario", "mesas"],
  "PATCH /api/restaurants/:id/tables/:number/position": ["funcionario", "mesas"],
  "PATCH /api/restaurants/:id/tables/:number": ["funcionario", "mesas"],
  "DELETE /api/restaurants/:id/tables/:number": ["funcionario", "mesas"],
  "GET /api/restaurants/:id/tables/:number/comanda": ["funcionario", "mesas"],
  "POST /api/restaurants/:id/tables/:number/orders": ["funcionario", "mesas"],
  "POST /api/restaurants/:id/tables/:number/close": ["funcionario", "mesas"],
  "POST /api/restaurants/:id/tables/:number/transfer": ["funcionario", "mesas"],
  "GET /api/restaurants/:id/tables/:number/qr": ["funcionario", "mesas"],
  "POST /api/restaurants/:id/tables/:number/qr": ["administrador", "mesas"],
  "GET /api/restaurants/:id/waiter-calls": ["funcionario", "mesas"],
  "POST /api/restaurants/:id/waiter-calls/:callId/resolve": ["funcionario", "mesas"],

  "PATCH /api/restaurants/:id/items/:itemId/sold-out": ["funcionario", "cardapio"],
  "POST /api/restaurants/:id/items": ["administrador", "cardapio"],
  "PATCH /api/restaurants/:id/items/:itemId": ["administrador", "cardapio"],
  "POST /api/restaurants/:id/items/:itemId/image": ["administrador", "cardapio"],
  "DELETE /api/restaurants/:id/items/:itemId": ["administrador", "cardapio"],
  "POST /api/restaurants/:id/items/:itemId/duplicate": ["administrador", "cardapio"],
  "POST /api/restaurants/:id/items/:itemId/move": ["administrador", "cardapio"],
  "POST /api/restaurants/:id/categories/:categoryId/move": ["administrador", "cardapio"],
  "POST /api/restaurants/:id/categories": ["administrador", "cardapio"],
  "PATCH /api/restaurants/:id/categories/:categoryId": ["administrador", "cardapio"],
  "DELETE /api/restaurants/:id/categories/:categoryId": ["administrador", "cardapio"],

  "GET /api/restaurants/:id/coupons": ["administrador", "promocoes"],
  "POST /api/restaurants/:id/coupons": ["administrador", "promocoes"],
  "PATCH /api/restaurants/:id/coupons/:couponId": ["administrador", "promocoes"],
  "DELETE /api/restaurants/:id/coupons/:couponId": ["administrador", "promocoes"],
  "POST /api/restaurants/:id/coupons/:couponId/duplicate": ["administrador", "promocoes"],

  "GET /api/restaurants/:id/tickets": ["atendimento", "atendimento"],
  "PATCH /api/restaurants/:id/tickets/:ticketId": ["atendimento", "atendimento"],
  "POST /api/restaurants/:id/tickets/:ticketId/messages": ["atendimento", "atendimento"],
  "POST /api/restaurants/:id/tickets/:ticketId/media": ["atendimento", "atendimento"],
  "GET /api/restaurants/:id/reviews": ["atendimento", "atendimento"],
  "POST /api/restaurants/:id/reviews/:reviewId/reply": ["atendimento", "atendimento"],
  "GET /api/restaurants/:id/whatsapp": ["atendimento", "atendimento"],
  "POST /api/restaurants/:id/whatsapp/terms": ["dono", "atendimento"],
  "POST /api/restaurants/:id/whatsapp/connect": ["dono", "atendimento"],
  "POST /api/restaurants/:id/whatsapp/disconnect": ["dono", "atendimento"],

  "GET /api/restaurants/:id/products": ["administrador", "produtos"],
  "POST /api/restaurants/:id/products": ["administrador", "produtos"],
  "PATCH /api/restaurants/:id/products/:productId": ["administrador", "produtos"],
  "GET /api/restaurants/:id/stock-movements": ["administrador", "produtos"],
  "POST /api/restaurants/:id/stock-movements/adjust": ["administrador", "produtos"],
  "POST /api/restaurants/:id/stock-movements/xml": ["administrador", "produtos"],

  "GET /api/restaurants/:id/analytics": ["administrador", "relatorios"],
  // Contas a Pagar / a Receber / Visão Geral: one table, the module follows the entry's kind (no kind: Visão Geral).
  "GET /api/restaurants/:id/finance-entries": ["administrador", "visao"],
  "POST /api/restaurants/:id/finance-entries": ["administrador", "pagar"],
  "POST /api/restaurants/:id/finance-entries/:entryId/pay": ["administrador", "pagar"],
  "DELETE /api/restaurants/:id/finance-entries/:entryId": ["administrador", "pagar"],
  "GET /api/restaurants/:id/closed-orders": ["administrador", "fiscal"],
  // Minha Fatura and Configurações are not modules.
  "GET /api/restaurants/:id/finance": ["administrador", null],
  "GET /api/restaurants/:id/payment-mode": ["funcionario", null],
  "GET /api/restaurants/:id/profile": ["dono", null],
  "PATCH /api/restaurants/:id/profile": ["dono", null],
  "GET /api/restaurants/:id/hours": ["dono", null],
  "PATCH /api/restaurants/:id/hours": ["dono", null],
  "GET /api/restaurants/:id/fiscal": ["dono", null],
  "PATCH /api/restaurants/:id/fiscal": ["dono", null],
  "PATCH /api/restaurants/:id/payment-mode": ["dono", null],
  "GET /api/restaurants/:id/appearance/draft": ["dono", null],
  "PATCH /api/restaurants/:id/appearance/draft": ["dono", null],
  "POST /api/restaurants/:id/appearance/publish": ["dono", null],
  "POST /api/restaurants/:id/appearance/upload": ["dono", null],
  "GET /api/restaurants/:id/staff": ["dono", null],
  "POST /api/restaurants/:id/staff": ["dono", null],
  "PATCH /api/restaurants/:id/staff/:staffId": ["dono", null]
};

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
const BELOW: Record<Min, string[]> = { funcionario: [], atendimento: ["kitchen"], administrador: ["waiter", "kitchen"], dono: ["waiter", "kitchen", "manager"] };
const MIN_ROLE: Record<Min, string> = { funcionario: "kitchen", atendimento: "waiter", administrador: "manager", dono: "owner" };
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
  const known = [...PUBLIC, ...WEBHOOK, ...SELF, ...SUPER_ADMIN, ...Object.keys(STAFF)];
  const routes = registeredRoutes();
  assert.ok(routes.length >= 100, `só ${routes.length} rotas encontradas`);
  assert.deepEqual(routes.filter((r) => !known.includes(r)), [], "rota nova: diga quem pode chamá-la neste teste");
  assert.deepEqual(known.filter((r) => !routes.includes(r)), [], "rota que não existe mais");
});

test("sem credencial: 401 em toda rota que não é pública; as públicas respondem sem token", async () => {
  const wrong: string[] = [];
  for (const route of [...WEBHOOK, ...SELF, ...SUPER_ADMIN, ...Object.keys(STAFF)]) {
    const { status } = await send(route);
    if (status !== 401) wrong.push(`${route} → ${status}`);
  }
  for (const route of PUBLIC) {
    const { status } = await send(route);
    if (status === 401 || status === 403 || status >= 500) wrong.push(`${route} (pública) → ${status}`);
  }
  assert.deepEqual(wrong, []);
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

test("credencial do super admin só vale com a chave inteira", async () => {
  assert.equal((await call("GET", "/api/admin/restaurants", { token: ADMIN_KEY })).status, 200);
  for (const token of [ADMIN_KEY.slice(0, -1), `${ADMIN_KEY}x`, ""]) assert.equal((await call("GET", "/api/admin/restaurants", { token })).status, 401, JSON.stringify(token));
});
