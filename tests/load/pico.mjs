// Horário de pico no Chapa 27 (seed de demonstração): `npm run test:carga` (tests/run.mjs sobe banco e API).
// 30 mesas carregam o cardápio e pedem ao mesmo tempo, em 3 rodadas, enquanto os painéis consultam a API no mesmo ritmo
// das telas reais: 4 Centrais de Pedidos (pedidos + chamados + turno a cada 4 s) e 6 tablets no Mapa do Salão (a cada
// 10 s), todos com o polling do menu lateral (pedidos, chamados, tickets a cada 15 s). No fim, os 30 garçons fecham as
// contas juntos. Mede o tempo do pedido até aparecer em cada Central (meta 5 s) e o do cardápio (meta 2 s).
// Sem dependência: só fetch do Node.
const API = process.env.API_URL ?? "http://localhost:4200";
const R = "chapa27";
const TABLES = 30;
const ROUNDS = 3;
const GOAL_PANEL_S = 5;
const GOAL_MENU_S = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lat = {}; // endpoint label → ms[]
async function hit(label, path, init = {}) {
  const t = performance.now();
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const body = await res.json().catch(() => null);
  (lat[label] ??= []).push(performance.now() - t);
  if (!res.ok) throw new Error(`${label} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)];
const fmt = (ms) => `${(ms / 1000).toFixed(2)} s`;

const login = async (u) => (await hit("login", "/api/auth/login", { method: "POST", body: JSON.stringify({ email: `${u}@chapa27.example`, password: process.env.SEED_DEMO_PASSWORD ?? "senha123" }) })).token;
const [kitchen, waiter] = [await login("cozinha"), await login("garcom")];
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const P = `/api/restaurants/${R}`;

// ---- painéis
let running = true;
const posted = new Map(); // order id → time it was sent (performance.now() before the POST)
const seenBy = []; // per Central: order id → first time it saw it
const errors = [];
function poll(everyMs, fn) {
  return (async () => {
    await sleep(Math.random() * everyMs); // screens opened at different moments
    while (running) {
      const t = performance.now();
      await fn().catch((e) => errors.push(e.message));
      await sleep(Math.max(0, everyMs - (performance.now() - t)));
    }
  })();
}
const panels = [];
for (let c = 0; c < 4; c++) {
  const seen = new Map();
  seenBy.push(seen);
  const token = c % 2 ? waiter : kitchen;
  panels.push(
    poll(4000, async () => {
      const [orders] = await Promise.all([hit("Central: pedidos", `${P}/orders`, auth(token)), hit("Central: chamados", `${P}/waiter-calls`, auth(token)), hit("Central: turno", `${P}/shift-stats`, auth(token))]);
      const now = performance.now();
      for (const o of orders) if (posted.has(o.id) && !seen.has(o.id)) seen.set(o.id, now);
    })
  );
}
for (let m = 0; m < 6; m++) panels.push(poll(10000, () => hit("Mapa do salão", `${P}/salon-grid`, auth(waiter))));
for (let s = 0; s < 10; s++) {
  const token = s % 2 ? waiter : kitchen;
  panels.push(poll(15000, () => Promise.all([hit("Menu lateral: pedidos", `${P}/orders`, auth(token)), hit("Menu lateral: chamados", `${P}/waiter-calls`, auth(token)), s % 2 ? hit("Menu lateral: tickets", `${P}/tickets`, auth(token)) : null])));
}

// ---- clientes nas mesas
const menuTimes = [];
async function guest(table, round) {
  const t = performance.now();
  const [, , items] = await Promise.all([hit("Cardápio: restaurante", `/api/restaurants/${R}`), hit("Cardápio: categorias", `${P}/categories`), hit("Cardápio: itens", `${P}/items`), hit("Cardápio: aparência", `${P}/appearance`)]);
  menuTimes.push(performance.now() - t);
  const pick = () => items[Math.floor(Math.random() * items.length)];
  const lines = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
    const it = pick();
    return { itemId: it.id, quantity: 1 + Math.floor(Math.random() * 2), notes: round === 0 ? "sem cebola" : "", selectedOptions: [] };
  });
  const sent = performance.now();
  const order = await hit("Enviar pedido", "/api/orders", { method: "POST", headers: { "X-Session-Id": `carga-${table}` }, body: JSON.stringify({ mode: "table", restaurantId: R, tableNumber: table, guestName: `Mesa ${table}`, lines }) });
  posted.set(order.id, sent);
}

await sleep(4000); // panels warm up
const t0 = performance.now();
for (let round = 0; round < ROUNDS; round++) {
  const results = await Promise.allSettled(Array.from({ length: TABLES }, (_, i) => guest(i + 1, round)));
  results.filter((r) => r.status === "rejected").forEach((r) => errors.push(r.reason.message));
  await sleep(15000);
}
await sleep(6000); // last orders reach every Central
running = false;
await Promise.all(panels);

// ---- os garçons fecham as 30 contas juntos
const closes = await Promise.allSettled(
  Array.from({ length: TABLES }, async (_, i) => {
    const comanda = await hit("Comanda", `${P}/tables/${i + 1}/comanda`, auth(waiter));
    return hit("Fechar conta", `${P}/tables/${i + 1}/close`, { method: "POST", ...auth(waiter), body: JSON.stringify({ orderIds: comanda.orderIds, paymentMethod: "Cartão" }) });
  })
);
closes.filter((r) => r.status === "rejected").forEach((r) => errors.push(r.reason.message));
const closedOrders = closes.reduce((t, r) => t + (r.status === "fulfilled" ? r.value.closed : 0), 0);

// ---- resultado
const perPanel = [];
const firstPanel = [];
for (const [id, sent] of posted) {
  const times = seenBy.map((s) => (s.has(id) ? s.get(id) - sent : Infinity));
  perPanel.push(...times);
  firstPanel.push(Math.min(...times));
}
const missed = perPanel.filter((t) => t === Infinity).length;
const secs = (performance.now() - t0) / 1000;
const totalRequests = Object.values(lat).reduce((t, xs) => t + xs.length, 0);

console.log(`\nPico: ${TABLES} mesas × ${ROUNDS} rodadas simultâneas, 4 Centrais + 6 mapas + 10 menus laterais consultando — ${totalRequests} requests em ${secs.toFixed(0)} s`);
console.log(`Pedidos gravados: ${posted.size}/${TABLES * ROUNDS} · fechados no fim: ${closedOrders} · erros: ${errors.length}`);
console.log(`Pedido → aparece na Central (cada uma das 4): p50 ${fmt(pct(perPanel, 50))} · p95 ${fmt(pct(perPanel, 95))} · máx ${fmt(Math.max(...perPanel))} · meta ${GOAL_PANEL_S} s${missed ? ` · ${missed} nunca apareceram` : ""}`);
console.log(`Pedido → aparece na primeira Central: p50 ${fmt(pct(firstPanel, 50))} · p95 ${fmt(pct(firstPanel, 95))}`);
console.log(`Cardápio (4 chamadas em paralelo, 30 clientes juntos): p50 ${fmt(pct(menuTimes, 50))} · p95 ${fmt(pct(menuTimes, 95))} · máx ${fmt(Math.max(...menuTimes))} · meta ${GOAL_MENU_S} s`);
console.log("\nLatência por endpoint (ms):  n · p50 · p95 · máx");
for (const [label, xs] of Object.entries(lat)) console.log(`  ${label.padEnd(26)} ${String(xs.length).padStart(4)} · ${pct(xs, 50).toFixed(0).padStart(4)} · ${pct(xs, 95).toFixed(0).padStart(4)} · ${Math.max(...xs).toFixed(0).padStart(4)}`);
if (errors.length) console.log("\nErros:", [...new Set(errors)].slice(0, 5).join("\n  "));

const ok = !errors.length && !missed && posted.size === TABLES * ROUNDS && closedOrders === posted.size && pct(perPanel, 95) <= GOAL_PANEL_S * 1000 && pct(menuTimes, 95) <= GOAL_MENU_S * 1000;
console.log(ok ? "\n✔ metas atingidas" : "\n✖ meta não atingida");
process.exit(ok ? 0 : 1);
