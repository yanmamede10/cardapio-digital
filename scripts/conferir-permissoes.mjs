// node scripts/conferir-permissoes.mjs — calls the GET routes of the permission matrix (tests/api/rotas.mjs, the same list the
// authorization test checks and docs/seguranca/permissoes.md shows) as each caller, on a running stack, and lists every answer
// that isn't the expected one. Only GET: nothing is created, changed or deleted (the one fetch below has no method to choose).
//
//   PERMISSOES_URL                     the stack, e.g. http://localhost:4100 or https://<IP-da-VM>
//   PERMISSOES_TOKEN_COZINHA           a staff token of each role, all of the same restaurant (POST /api/auth/login → token)
//   PERMISSOES_TOKEN_GARCOM
//   PERMISSOES_TOKEN_ADMINISTRADOR
//   PERMISSOES_TOKEN_DONO              (required: it reads the restaurant, its modules, an item, a table and its QR)
//   PERMISSOES_SUPER_ADMIN_KEY         the super admin key
// A missing token leaves its column out. Exit code 1 when anything differs.
import { ROUTES, expected } from "../tests/api/rotas.mjs";

const BASE = process.env.PERMISSOES_URL?.replace(/\/$/, "");
const TOKENS = {
  kitchen: process.env.PERMISSOES_TOKEN_COZINHA,
  waiter: process.env.PERMISSOES_TOKEN_GARCOM,
  manager: process.env.PERMISSOES_TOKEN_ADMINISTRADOR,
  owner: process.env.PERMISSOES_TOKEN_DONO,
  superadmin: process.env.PERMISSOES_SUPER_ADMIN_KEY
};
const COLUMN = { anon: "Sem login", kitchen: "Cozinha", waiter: "Garçom", manager: "Administrador", owner: "Dono", superadmin: "Super Admin" };
if (!BASE || !TOKENS.owner) {
  console.error("Defina PERMISSOES_URL e ao menos PERMISSOES_TOKEN_DONO (ver o cabeçalho deste arquivo).");
  process.exit(2);
}

/** The only request this script makes: a GET. */
async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, { method: "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "X-Session-Id": crypto.randomUUID() } });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => null) : null;
  return { status: res.status, body };
}

// The real ids the routes need, read as the Dono (GET only).
const me = await get("/api/auth/me", TOKENS.owner);
if (me.status !== 200) {
  console.error(`O token do Dono não vale (GET /api/auth/me → ${me.status}).`);
  process.exit(2);
}
const restaurantId = me.body.staff.restaurantId;
const modules = me.body.modules;
const items = await get(`/api/restaurants/${restaurantId}/items`);
const tables = await get(`/api/restaurants/${restaurantId}/tables`, TOKENS.owner);
const number = tables.body?.[0]?.number;
const qr = number ? await get(`/api/restaurants/${restaurantId}/tables/${number}/qr`, TOKENS.owner) : null;
const PARAMS = { id: restaurantId, itemId: items.body?.[0]?.id, number, tableCode: qr?.body?.tableCode };
/** Not checked here: the answer depends on a record this script can't make with GETs only. */
const SKIP = { "GET /api/orders/:id": "precisa de um pedido feito por este aparelho (POST)" };

const divergences = [];
const skipped = [];
let checked = 0;
for (const [route, rule] of ROUTES) {
  if (!route.startsWith("GET ")) continue;
  if (SKIP[route]) {
    skipped.push(`${route}: ${SKIP[route]}`);
    continue;
  }
  const path = route.slice(4).replace(/:(\w+)/g, (_, p) => PARAMS[p] ?? `:${p}`);
  if (path.includes(":")) {
    skipped.push(`${route}: sem um ${path.match(/:(\w+)/)[1]} para usar`);
    continue;
  }
  const want = expected(rule);
  // A module the restaurant doesn't have: its staff routes answer 403 to every role.
  const off = rule.access === "staff" && rule.module && !rule.module.split("|").some((m) => modules.includes(m));
  for (const caller of Object.keys(COLUMN)) {
    if (caller !== "anon" && !TOKENS[caller]) continue;
    const exp = off && want[caller] === 200 && caller !== "superadmin" ? 403 : want[caller];
    const { status } = await get(path, caller === "anon" ? undefined : TOKENS[caller]);
    checked++;
    if (status !== exp) divergences.push({ route, caller: COLUMN[caller], exp, status });
  }
}

console.log(`Restaurante ${restaurantId} · módulos: ${modules.join(", ")}`);
console.log(`${checked} chamadas GET conferidas · ${divergences.length} divergência(s) · ${skipped.length} rota(s) não conferida(s)`);
for (const d of divergences) console.log(`  DIVERGE  ${d.route}  ${d.caller}: esperado ${d.exp}, veio ${d.status}`);
for (const s of skipped) console.log(`  PULADA   ${s}`);
const missing = Object.entries(TOKENS).filter(([, t]) => !t).map(([k]) => COLUMN[k]);
if (missing.length) console.log(`  Sem token (coluna fora): ${missing.join(", ")}`);
process.exit(divergences.length ? 1 : 0);
