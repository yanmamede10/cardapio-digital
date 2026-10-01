import assert from "node:assert/strict";
import { before, test } from "node:test";
import { clientIp, LIMITS } from "../../apps/api/src/lib/rateLimit.ts";
import { call, login, newTable, tableCode } from "./helpers.ts";

// Rate limits (apps/api/src/lib/rateLimit.ts). The API trusts CF-Connecting-IP on loopback (the Cloudflare tunnel), so these
// tests pose as visitors from documentation IPs (RFC 5737). Every other test file calls from this machine without the
// header: no per-IP limit applies to that, the staff member's, the table's and the account's do (last test here).
const D = "chapa27";
const from = (ip: string, headers: Record<string, string> = {}) => ({ "CF-Connecting-IP": ip, ...headers });
const kids = { quantity: 1, notes: "", selectedOptions: [] as unknown[] };
let owner: string;
let itemId: string;

before(async () => {
  owner = await login();
  itemId = (await call("GET", "/api/restaurants/fogo/items")).body.find((i: { soldOut: boolean }) => !i.soldOut).id;
});

/** The orders these tests send stay on their new tables, waiting: refused at the end, so fogo's Central stays clean. */
async function refuseOrdersAt(tables: { number: number }[]) {
  const numbers = new Set(tables.map((t) => t.number));
  const orders = (await call("GET", "/api/restaurants/fogo/orders", { token: owner })).body as { id: string; status: string; tableNumber: number }[];
  for (const o of orders.filter((o) => numbers.has(o.tableNumber) && ["awaiting", "pending"].includes(o.status))) await call("POST", `/api/orders/${o.id}/reject`, { token: owner });
}

/** Runs `n` calls, 50 at a time; returns their statuses. */
async function burst(n: number, one: (i: number) => Promise<{ status: number }>) {
  const statuses: number[] = [];
  for (let i = 0; i < n; i += 50) statuses.push(...(await Promise.all(Array.from({ length: Math.min(50, n - i) }, (_, j) => one(i + j)))).map((r) => r.status));
  return statuses;
}

test("CF-Connecting-IP só vale numa conexão da própria máquina (o túnel); de fora vale o endereço da conexão", () => {
  const req = (remoteAddress: string, cf?: string) => ({ socket: { remoteAddress }, header: (n: string) => (n.toLowerCase() === "cf-connecting-ip" ? cf : undefined) });
  assert.equal(clientIp(req("127.0.0.1", "203.0.113.9") as never), "203.0.113.9");
  assert.equal(clientIp(req("::ffff:127.0.0.1", "203.0.113.9") as never), "203.0.113.9");
  assert.equal(clientIp(req("192.168.0.20", "203.0.113.9") as never), "192.168.0.20", "da rede local, o cabeçalho é ignorado");
  assert.equal(clientIp(req("127.0.0.1") as never), null, "a própria máquina, sem o túnel");
});

test("casa cheia no mesmo IP (40 mesas × 7 aparelhos + 10 aparelhos da equipe, um minuto de uso) não é bloqueada", async () => {
  const IP = "198.51.100.7";
  const staffTokens = await Promise.all(["dono", "gerente", "garcom", "cozinha"].map(async (u) => (await call("POST", "/api/auth/login", { body: { email: `${u}@chapa27.example`, password: "senha123" } })).body.token as string));
  // 30 tables of the demo (polling only, so their comandas stay as they are) + 10 new ones at fogo that also order.
  const demo = await Promise.all(Array.from({ length: 30 }, (_, i) => tableCode(D, i + 1, staffTokens[2])));
  const fresh: { number: number; code: string }[] = [];
  for (let i = 0; i < 10; i++) fresh.push(await newTable(owner)); // one at a time: a table takes the next number
  const codes = [...demo, ...fresh.map((t) => t.code)];

  // Per table: 7 devices × 25 requests (status every 3 s, menu every 12 s, opening dishes). The limit counts every request
  // alike, before routing, so the volume goes through /api/health; the orders are real.
  const polling = await burst(codes.length * 7 * 25, (i) => call("GET", "/api/health", { headers: from(IP, { "X-Table-Code": codes[i % codes.length] }) }));
  const orders = await burst(fresh.length * 7, (i) =>
    call("POST", "/api/orders", { session: crypto.randomUUID(), headers: from(IP, { "X-Table-Code": fresh[i % 10].code }), body: { mode: "table", restaurantId: "fogo", tableCode: fresh[i % 10].code, lines: [{ itemId, ...kids }] } })
  );
  // Staff: 10 devices (4 logins) × 57 requests (the Central every 4 s + the menu badges every 15 s).
  const staff = await burst(10 * 57, (i) => call("GET", "/api/health", { headers: from(IP, { Authorization: `Bearer ${staffTokens[i % 4]}` }) }));

  const all = [...polling, ...orders, ...staff];
  assert.equal(all.length, 40 * 7 * 25 + 70 + 570);
  assert.equal(all.filter((s) => s === 429).length, 0, `429 — polling ${polling.filter((s) => s === 429).length}, pedidos ${orders.filter((s) => s === 429).length}, equipe ${staff.filter((s) => s === 429).length}`);
  assert.deepEqual([...new Set(orders)], [201]);
  assert.ok(all.length < LIMITS.IP_PER_MINUTE / 1.9, "a casa cheia usa menos da metade do teto por IP");
  await refuseOrdersAt(fresh);
});

test("uma mesa acima do limite recebe 429 (com Retry-After e mensagem) sem afetar outra mesa no mesmo IP", async () => {
  const IP = "198.51.100.8";
  const [a, b, c, d] = [await newTable(owner), await newTable(owner), await newTable(owner), await newTable(owner)];
  const poll = (code: string) => call("GET", "/api/health", { headers: from(IP, { "X-Table-Code": code }) });
  const ok = await burst(LIMITS.TABLE_PER_MINUTE, () => poll(a.code));
  assert.deepEqual([...new Set(ok)], [200]);
  const over = await fetch(`${process.env.API_URL ?? "http://localhost:4200"}/api/health`, { headers: from(IP, { "X-Table-Code": a.code }) });
  assert.equal(over.status, 429);
  const retry = Number(over.headers.get("Retry-After"));
  assert.ok(retry > 0 && retry <= 60, `Retry-After ${retry}`);
  assert.match((await over.json()).error, /^Muitas tentativas em pouco tempo\. Tente de novo em \d+ s\.$/);
  assert.equal((await poll(b.code)).status, 200, "outra mesa, mesmo IP");

  // Orders from one table: 40 in 5 minutes, the 41st waits; another table still orders.
  const order = (t: { code: string }) => call("POST", "/api/orders", { session: crypto.randomUUID(), headers: from(IP), body: { mode: "table", restaurantId: "fogo", tableCode: t.code, lines: [{ itemId, ...kids }] } });
  const placed = await burst(LIMITS.TABLE_ORDERS_PER_5_MINUTES, () => order(c));
  assert.deepEqual([...new Set(placed)], [201]);
  assert.equal((await order(c)).status, 429);
  assert.equal((await order(d)).status, 201, "outra mesa pede normalmente");
  await refuseOrdersAt([a, b, c, d]);
});

test("a 6ª senha errada de uma conta recebe 429 mesmo vindo de outro IP; outra conta segue entrando", async () => {
  const email = `trava-${crypto.randomUUID().slice(0, 8)}@t.com`;
  assert.equal((await call("POST", "/api/restaurants/fogo/staff", { token: owner, body: { name: "Trava", email, role: "waiter", password: "senha-certa-1" } })).status, 201);
  const attempt = (password: string, ip: string) => call("POST", "/api/auth/login", { headers: from(ip), body: { email, password } });
  for (let i = 1; i <= 5; i++) assert.equal((await attempt(`errada-${i}`, "203.0.113.10")).status, 401, `erro ${i}`);
  const sixth = await attempt("errada-6", "203.0.113.99");
  assert.equal(sixth.status, 429, "6ª tentativa, de outro IP");
  assert.match(sixth.body.error, /Tente de novo em \d+ min\./);
  assert.equal((await attempt("senha-certa-1", "203.0.113.50")).status, 429, "nem a senha certa entra até a janela passar");
  assert.equal((await call("POST", "/api/auth/login", { headers: from("203.0.113.99"), body: { email: "bruno@fogoeno.com.br", password: "senha123" } })).status, 200, "outra conta, do mesmo IP");
});

test("teto de tentativas de login por IP: a 51ª em 15 minutos espera, mesmo em contas diferentes", async () => {
  const IP = "203.0.113.77";
  const statuses = await burst(LIMITS.LOGIN_ATTEMPTS_PER_IP_PER_15_MINUTES + 1, (i) => call("POST", "/api/auth/login", { headers: from(IP), body: { email: `ninguem-${i}@t.com`, password: "qualquer-1" } }));
  assert.equal(statuses.filter((s) => s === 401).length, LIMITS.LOGIN_ATTEMPTS_PER_IP_PER_15_MINUTES);
  assert.equal(statuses.filter((s) => s === 429).length, 1);
});

test("sem CF-Connecting-IP (a própria máquina) não há limite por IP, mas valem o da mesa, o dos pedidos da mesa, o do funcionário e o bloqueio da conta", async () => {
  const [a, b] = [await newTable(owner), await newTable(owner)];
  const poll = await burst(LIMITS.TABLE_PER_MINUTE + 1, () => call("GET", "/api/health", { headers: { "X-Table-Code": a.code } }));
  assert.deepEqual([poll.filter((s) => s === 200).length, poll.filter((s) => s === 429).length], [LIMITS.TABLE_PER_MINUTE, 1], "mesa");

  const order = () => call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "table", restaurantId: "fogo", tableCode: b.code, lines: [{ itemId, ...kids }] } });
  const placed = await burst(LIMITS.TABLE_ORDERS_PER_5_MINUTES + 1, order);
  assert.deepEqual([placed.filter((s) => s === 201).length, placed.filter((s) => s === 429).length], [LIMITS.TABLE_ORDERS_PER_5_MINUTES, 1], "pedidos da mesa");
  await refuseOrdersAt([a, b]);

  // A staff member of their own: the limit holds every device of that login, and no other test logs in as them.
  const email = `limite-${crypto.randomUUID().slice(0, 8)}@t.com`;
  assert.equal((await call("POST", "/api/restaurants/fogo/staff", { token: owner, body: { name: "Limite", email, role: "waiter", password: "senha-certa-1" } })).status, 201);
  const staff = (await call("POST", "/api/auth/login", { body: { email, password: "senha-certa-1" } })).body.token as string;
  const central = await burst(LIMITS.STAFF_PER_MINUTE + 1, () => call("GET", "/api/health", { token: staff }));
  assert.deepEqual([central.filter((s) => s === 200).length, central.filter((s) => s === 429).length], [LIMITS.STAFF_PER_MINUTE, 1], "funcionário");

  for (let i = 1; i <= LIMITS.ACCOUNT_FAILURES_PER_15_MINUTES; i++) assert.equal((await call("POST", "/api/auth/login", { body: { email, password: `errada-${i}` } })).status, 401, `erro ${i}`);
  assert.equal((await call("POST", "/api/auth/login", { body: { email, password: "senha-certa-1" } })).status, 429, "conta bloqueada, nem a senha certa entra");
});
