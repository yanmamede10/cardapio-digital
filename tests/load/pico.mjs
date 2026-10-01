// Casa cheia no Chapa 27 com o cenário de tests/load/cenario.mjs: `npm run carga` (tests/run.mjs sobe banco e API).
// Cada aparelho segue o polling real dos apps:
//   Central de Pedidos  pedidos + chamados + turno a cada 4 s             apps/dashboard/src/screens/OrdersScreen.tsx:77
//   menu lateral        pedidos + chamados (+ tickets) a cada 15 s        apps/dashboard/src/lib/live.ts:33
//   cardápio aberto     itens (disponibilidade) a cada 12 s               apps/web/src/screens/MenuScreen.tsx:58
//   status do pedido    a cada 3 s enquanto aguarda aceite ou Recebido    apps/web/src/screens/OrderStatusScreen.tsx:38
// Tudo sai do mesmo IP (CF-Connecting-IP), então os limites de apps/api/src/lib/rateLimit.ts valem como na demonstração.
// Mede: rotas públicas do cardápio (p50/p95/p99), pedido → aparece em cada Central, respostas 4xx/5xx (cada 429 com a
// chave e a contagem na janela), CPU e memória da API e da Evolution durante o pico. Sem dependência: só fetch do Node.
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import C from "./cenario.mjs";

const API = process.env.API_URL ?? "http://localhost:4200";
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "senha123";
const P = `/api/restaurants/${C.restaurante}`;
const POLL = { central: 4000, menuLateral: 15000, cardapio: 12000, status: 3000 };
// The API's limits, read from its source so a 429 is shown against the number that is really there.
const LIMITS = Object.fromEntries(
  [...readFileSync(new URL("../../apps/api/src/lib/rateLimit.ts", import.meta.url), "utf8").matchAll(/^\s+([A-Z_]+): ([\d_]+),?$/gm)].map(([, k, v]) => [k, Number(v.replaceAll("_", ""))])
);
// Rate-limit key → [limit, window in s]. Same keys as rateLimit(): the IP; the staff member or else the table; a table's orders.
const RULES = { ip: ["IP_PER_MINUTE", 60], equipe: ["STAFF_PER_MINUTE", 60], mesa: ["TABLE_PER_MINUTE", 60], pedidos: ["TABLE_ORDERS_PER_5_MINUTES", 300], logins: ["LOGIN_ATTEMPTS_PER_IP_PER_15_MINUTES", 900] };

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)] ?? NaN;
const s = (ms) => `${(ms / 1000).toFixed(2)} s`;

const lat = {}; // route → ms[]
const failures = {}; // "status route" → count
const tooMany = []; // every 429, with the request's keys and how many requests each had in its window
const counted = {}; // rate-limit key → timestamps
let running = true;

/** One request as the app makes it. `as`: a staff device ({ token, login }) or a customer device ({ table, code, session }). */
async function hit(route, path, as = {}, method = "GET", body) {
  const keys = ["ip:Wi-Fi", as.token ? `equipe:${as.login}` : as.code ? `mesa:${as.table}` : null, body?.tableCode ? `pedidos:${as.table}` : null, path === "/api/auth/login" ? "logins:Wi-Fi" : null].filter(Boolean);
  const at = Date.now();
  for (const k of keys) (counted[k] ??= []).push(at);
  const headers = { "Content-Type": "application/json", "CF-Connecting-IP": C.ipDoWifi };
  if (as.token) headers.Authorization = `Bearer ${as.token}`;
  if (as.code) headers["X-Table-Code"] = as.code;
  if (as.session) headers["X-Session-Id"] = as.session;
  const t = performance.now();
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body && JSON.stringify(body) });
  } catch (e) {
    failures[`rede ${route}`] = (failures[`rede ${route}`] ?? 0) + 1;
    throw e;
  }
  const data = await res.json().catch(() => null);
  (lat[route] ??= []).push(performance.now() - t);
  if (res.ok) return data;
  failures[`${res.status} ${route}`] = (failures[`${res.status} ${route}`] ?? 0) + 1;
  if (res.status === 429)
    tooMany.push({
      route,
      retryAfter: res.headers.get("retry-after"),
      keys: keys.map((k) => {
        const [limit, win] = RULES[k.split(":")[0]];
        return `${k} ${counted[k].filter((x) => x > at - win * 1000).length}/${LIMITS[limit]} em ${win} s (${limit})`;
      })
    });
  throw new Error(`${route} → ${res.status} ${data?.error ?? ""}`);
}

/** The apps' setInterval: fires every `ms` whether or not the last one answered; the first one at a random moment. */
const timers = [];
function every(ms, fn) {
  const go = () => running && fn().catch(() => {});
  timers.push(setTimeout(() => (go(), timers.push(setInterval(go, ms))), Math.random() * ms));
}

// ---- preparo: os QR das mesas (a requisição da própria máquina, fora da conta do Wi-Fi)
const setup = await (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `dono@${C.restaurante}.example`, password: PASSWORD }) })).json();
const codes = {};
for (let t = 1; t <= C.mesas; t++) codes[t] = (await (await fetch(`${API}${P}/tables/${t}/qr`, { headers: { Authorization: `Bearer ${setup.token}` } })).json()).tableCode;

// ---- equipe: Centrais de Pedidos, uma delas a cozinha que aceita e começa o preparo
const posted = new Map(); // order id → { at: Date.now() before its POST, table }
const seenBy = []; // per Central: order id → ms from its POST until that Central's poll listed it
const since = new Map(); // "id status" → when the kitchen first saw it so; 0 once acted on
function kitchen(orders, as) {
  for (const o of orders) {
    if (!posted.has(o.id) || (o.status !== "awaiting" && o.status !== "pending")) continue;
    const k = `${o.id} ${o.status}`;
    if (!since.has(k)) since.set(k, Date.now());
    else if (since.get(k) && Date.now() - since.get(k) >= (o.status === "awaiting" ? C.aceiteS : C.preparoS) * 1000) {
      since.set(k, 0);
      hit(o.status === "awaiting" ? "Aceitar (abre a mesa)" : "Aceitar (preparo)", `/api/orders/${o.id}/accept`, as, "POST").catch(() => {});
    }
  }
}
async function central(i) {
  const login = C.logins[i % C.logins.length];
  const { token, staff } = await hit("Login", "/api/auth/login", {}, "POST", { email: `${login}@${C.restaurante}.example`, password: PASSWORD });
  const as = { token, login };
  const seen = new Map();
  seenBy.push(seen);
  every(POLL.central, async () => {
    const [orders] = await Promise.all([hit("Central: pedidos", `${P}/orders`, as), hit("Central: chamados", `${P}/waiter-calls`, as), hit("Central: turno", `${P}/shift-stats`, as)]);
    for (const o of orders) if (posted.has(o.id) && !seen.has(o.id)) seen.set(o.id, Date.now() - posted.get(o.id).at);
    if (i === 0) kitchen(orders, as);
  });
  // Tickets only for the roles that see Atendimento (the kitchen doesn't): apps/dashboard/src/lib/modules.ts.
  every(POLL.menuLateral, () => Promise.all([hit("Menu lateral: pedidos", `${P}/orders`, as), hit("Menu lateral: chamados", `${P}/waiter-calls`, as), staff.role !== "kitchen" && hit("Menu lateral: tickets", `${P}/tickets`, as)]));
}

// ---- clientes: celulares que chegam pelo QR e tablets fixos
const menuTimes = []; // restaurant + categories + items in parallel: what MenuScreen waits for before showing the menu
const devices = [];
for (let t = 1; t <= C.mesas; t++) {
  for (let c = 0; c < C.celularesPorMesa; c++) devices.push({ table: t, tablet: false });
  if (t <= C.tablets) devices.push({ table: t, tablet: true });
}
async function customer(d) {
  const as = { table: d.table, code: codes[d.table], session: crypto.randomUUID() };
  await sleep(Math.random() * (d.tablet ? 5 : C.rampaS) * 1000);
  // The QR opens /t/<code>: the app resolves the table before it knows it (no X-Table-Code yet).
  if (!d.tablet) await hit("Cardápio: GET /api/tables/:qr", `/api/tables/${as.code}`, { session: as.session }).catch(() => {});
  while (running) {
    const t = performance.now();
    hit("Cardápio: aparência", `${P}/appearance`, as).catch(() => {});
    let [, , items] = await Promise.all([hit("Cardápio: restaurante", P, as), hit("Cardápio: categorias", `${P}/categories`, as), hit("Cardápio: itens", `${P}/items`, as)]).catch(() => []);
    if (!items) {
      await sleep(POLL.cardapio); // the app shows "Não foi possível carregar o cardápio"; the customer tries again
      continue;
    }
    menuTimes.push(performance.now() - t);
    d.browsing = true;
    let nextItems = Date.now() + POLL.cardapio;
    let nextDish = Date.now() - Math.log(Math.random()) * C.abrePratoS * 1000;
    while (running && !d.order) {
      await sleep(250);
      if (Date.now() >= nextItems) (nextItems += POLL.cardapio), hit("Cardápio: itens", `${P}/items`, as).then((i) => (items = i)).catch(() => {});
      if (Date.now() >= nextDish) (nextDish = Date.now() - Math.log(Math.random()) * C.abrePratoS * 1000), hit("Cardápio: prato", `${P}/items/${pick(items).id}`, as).catch(() => {});
    }
    d.browsing = false;
    if (!running) break;
    d.order = false;
    const available = items.filter((i) => !i.soldOut);
    if (!available.length) continue;
    const lines = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({ itemId: pick(available).id, quantity: 1 + Math.floor(Math.random() * 2), notes: "", selectedOptions: [] }));
    const at = Date.now();
    let order = await hit("Enviar pedido", "/api/orders", as, "POST", { mode: "table", restaurantId: C.restaurante, tableCode: as.code, guestName: `Mesa ${d.table}`, lines }).catch(() => null);
    if (!order) continue;
    posted.set(order.id, { at, table: d.table });
    while (running && (order.status === "awaiting" || order.status === "pending")) {
      await sleep(POLL.status);
      order = await hit("Status do pedido", `/api/orders/${order.id}`, as).catch(() => null); // a failed poll stops it, as in the app
      if (!order) break;
    }
    // "Voltar ao cardápio": MenuScreen mounts again (next loop).
  }
}

// ---- consumo: o processo que escuta na porta da API e o contêiner da Evolution, a cada ~5 s
// ponytail: Windows (PowerShell) and Linux (ps cputimes) only; macOS would need another `ps` format.
function watch(cmd, args, parse) {
  const samples = [];
  const p = spawn(cmd, args);
  p.stdout.on("data", (b) => String(b).split(/\r?\n/).forEach((l) => { const v = parse(l); if (v) samples.push({ at: Date.now(), ...v }); }));
  p.on("error", () => {});
  return { samples, stop: () => p.kill() };
}
function apiPid() {
  const port = new URL(API).port;
  if (process.platform === "win32") return execSync("netstat -ano -p TCP").toString().split("\n").find((l) => l.includes(`:${port} `) && l.includes("LISTENING"))?.trim().split(/\s+/).pop();
  return execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`).toString().trim().split("\n")[0];
}
const MB = { B: 1 / 2 ** 20, KiB: 1 / 1024, MiB: 1, GiB: 1024 };
function watchUsage() {
  const pid = apiPid();
  const api = watch(
    ...(process.platform === "win32"
      ? ["powershell", ["-NoProfile", "-Command", `while ($true) { $p = Get-Process -Id ${pid}; "$($p.TotalProcessorTime.TotalSeconds) $($p.WorkingSet64)"; Start-Sleep 5 }`]]
      : ["sh", ["-c", `while true; do ps -o cputimes=,rss= -p ${pid} | awk '{print $1, $2 * 1024}'; sleep 5; done`]]),
    (l) => (/^[\d.]+ \d+$/.test(l.trim()) ? { cpu: Number(l.trim().split(" ")[0]), mb: Number(l.trim().split(" ")[1]) / 2 ** 20 } : null)
  );
  const evo = watch("docker", ["stats", "--format", "{{.CPUPerc}} {{.MemUsage}}", C.evolution], (l) => {
    const m = l.match(/([\d.]+)%\s+([\d.]+)(B|KiB|MiB|GiB)/);
    return m ? { pct: Number(m[1]), mb: Number(m[2]) * MB[m[3]] } : null;
  });
  return { pid, api, evo };
}
function usageLine(name, samples, cpuPct) {
  if (!samples.length) return `${name}: sem amostras`;
  return `${name}: CPU média ${(cpuPct.reduce((a, b) => a + b, 0) / cpuPct.length).toFixed(0)}% · máx ${Math.max(...cpuPct).toFixed(0)}% de um núcleo · memória máx ${Math.max(...samples.map((x) => x.mb)).toFixed(0)} MB (${samples.length} amostras)`;
}

// ---- a noite
const start = Date.now();
await Promise.all(Array.from({ length: C.centrais }, (_, i) => central(i)));
const customers = devices.map(customer);
await sleep(C.rampaS * 1000);

const usage = watchUsage();
const peak = Date.now();
const total = C.pedidosPorMinuto * C.picoMin;
let assigned = 0;
for (let n = 0; n < total; n++) {
  await sleep(peak + (n * 60000) / C.pedidosPorMinuto - Date.now());
  const idle = devices.filter((d) => d.browsing && !d.order && d.table !== C.mesaMedida);
  if (idle.length) (pick(idle).order = true), assigned++;
}
await sleep(10000); // the last orders reach every Central
const peakS = (Date.now() - peak) / 1000;
usage.api.stop();
usage.evo.stop();
running = false;
timers.forEach(clearInterval);
await Promise.all(customers);

// ---- fim da noite: os garçons fecham as contas (a mesa medida é do teste do painel)
const waiter = { token: (await hit("Login", "/api/auth/login", {}, "POST", { email: `garcom@${C.restaurante}.example`, password: PASSWORD })).token, login: "garcom" };
// A free table's order sent in the last seconds may still wait for Aceitar: refused, so no table is left with one.
for (const o of await hit("Central: pedidos", `${P}/orders`, waiter).catch(() => []))
  if (posted.has(o.id) && o.status === "awaiting") await hit("Recusar", `/api/orders/${o.id}/reject`, waiter, "POST").catch(() => {});
let closed = 0;
await Promise.all(
  Array.from({ length: C.mesas }, async (_, i) => {
    if (i + 1 === C.mesaMedida) return;
    const comanda = await hit("Comanda", `${P}/tables/${i + 1}/comanda`, waiter).catch(() => null);
    if (!comanda?.orderIds?.length) return;
    const r = await hit("Fechar conta", `${P}/tables/${i + 1}/close`, waiter, "POST", { orderIds: comanda.orderIds, paymentMethod: "Cartão" }).catch(() => ({ closed: 0 }));
    closed += r.closed;
  })
);

// ---- resultado
const perCentral = [];
const firstCentral = [];
for (const id of posted.keys()) {
  const times = seenBy.map((m) => m.get(id) ?? Infinity);
  perCentral.push(...times);
  firstCentral.push(Math.min(...times));
}
const missed = perCentral.filter((t) => t === Infinity).length;
const all = Object.values(lat).flat().length;
const inPeak = (counted["ip:Wi-Fi"] ?? []).filter((t) => t >= peak).length;
const failed = Object.values(failures).reduce((a, b) => a + b, 0);
const apiCpu = usage.api.samples.slice(1).map((x, i) => ((x.cpu - usage.api.samples[i].cpu) / ((x.at - usage.api.samples[i].at) / 1000)) * 100);
const row = (label, xs) => `  ${label.padEnd(30)} ${String(xs.length).padStart(5)} · ${[50, 95, 99].map((p) => pct(xs, p).toFixed(0).padStart(5)).join(" · ")} · ${Math.max(...xs).toFixed(0).padStart(5)}`;

console.log(`\nCasa cheia: ${C.mesas} mesas × ${C.celularesPorMesa} celulares + ${C.tablets} tablets + ${C.centrais} Centrais, ${C.pedidosPorMinuto} pedidos/min por ${C.picoMin} min, tudo do IP ${C.ipDoWifi}`);
console.log(`Máquina: ${os.cpus()[0].model.trim()} · ${os.cpus().length} threads · ${(os.totalmem() / 2 ** 30).toFixed(0)} GB · ${os.type()} ${os.release()} · Node ${process.version} · API ${API}`);
console.log(`${all} requisições em ${((Date.now() - start) / 1000).toFixed(0)} s; no pico, ${Math.round(inPeak / (peakS / 60))}/min do IP do Wi-Fi`);
console.log(`Pedidos: ${posted.size} gravados de ${assigned} enviados (${total} no cenário) · contas fechadas no fim com ${closed} pedidos`);
console.log(`\nCardápio montado (restaurante + categorias + itens em paralelo): p50 ${s(pct(menuTimes, 50))} · p95 ${s(pct(menuTimes, 95))} · p99 ${s(pct(menuTimes, 99))} · máx ${s(Math.max(...menuTimes))} · meta ${C.metas.cardapioS} s`);
console.log(`Pedido → aparece em cada Central: p50 ${s(pct(perCentral, 50))} · p95 ${s(pct(perCentral, 95))} · máx ${s(Math.max(...perCentral))} · meta ${C.metas.painelS} s${missed ? ` · ${missed} nunca apareceram` : ""}`);
console.log(`Pedido → aparece na primeira Central: p50 ${s(pct(firstCentral, 50))} · p95 ${s(pct(firstCentral, 95))} · máx ${s(Math.max(...firstCentral))}`);
console.log(`\nRespostas 4xx/5xx: ${failed} de ${all} · 429: ${tooMany.length}`);
for (const [k, n] of Object.entries(failures)) console.log(`  ${n} × ${k}`);
for (const t of tooMany.slice(0, 10)) console.log(`  429 ${t.route} (Retry-After ${t.retryAfter} s): ${t.keys.join(" · ")}`);
console.log(`\nConsumo durante o pico (${peakS.toFixed(0)} s):`);
console.log(`  ${usageLine(`API (pid ${usage.pid})`, usage.api.samples, apiCpu)}`);
console.log(`  ${usageLine(`Evolution (${C.evolution})`, usage.evo.samples, usage.evo.samples.map((x) => x.pct))}`);
console.log("\nLatência por rota (ms):              n ·   p50 ·   p95 ·   p99 ·   máx");
for (const [label, xs] of Object.entries(lat)) console.log(row(label, xs));

const ok = !tooMany.length && !missed && posted.size === assigned && pct(menuTimes, 95) <= C.metas.cardapioS * 1000 && pct(perCentral, 95) <= C.metas.painelS * 1000;
console.log(ok ? "\n✔ metas atingidas, nenhum 429" : "\n✖ meta não atingida");
process.exit(ok ? 0 : 1);
