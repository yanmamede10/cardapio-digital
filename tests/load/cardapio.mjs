// Cardápio no Lighthouse (PERF-01), em modo celular: o padrão do Lighthouse, 4G lenta simulada (150 ms, 1,6 Mbps) e CPU 4×
// mais lenta. Na rota do QR da mesa (/t/<código>, tela de celular 412×823) e na do tablet fixo (a mesma rota numa tela de
// 1280×800). `npm run carga` roda isto com a casa cheia de pico.mjs em andamento, contra o app construído (vite build +
// preview em :5273). Três medições por rota; vale a mediana. Relatórios em test-results/lighthouse-*.html.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import C from "./cenario.mjs";

const API = process.env.API_URL ?? "http://localhost:4200";
const WEB = "http://localhost:5273";
const PORT = 9333; // Chrome's debugging port, where Lighthouse connects
const s = (ms) => `${(ms / 1000).toFixed(2)} s`;

const { token } = await (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `dono@${C.restaurante}.example`, password: process.env.SEED_DEMO_PASSWORD ?? "senha123" }) })).json();
const qr = async (n) => `${WEB}/t/${(await (await fetch(`${API}/api/restaurants/${C.restaurante}/tables/${n}/qr`, { headers: { Authorization: `Bearer ${token}` } })).json()).tableCode}`;

// No CF-Connecting-IP here: Lighthouse adds its headers to every request, cdnjs then blocks the Font Awesome CSS and the
// menu loads without icons, ~0.75 s faster than a real phone (measured). Its ~6 API calls per run are noise next to the house's.
const browser = await chromium.launch({ channel: "chrome", args: [`--remote-debugging-port=${PORT}`] });
mkdirSync("test-results", { recursive: true });
let ok = true;
for (const [name, url, settings] of [
  ["celular (QR da mesa)", await qr(C.tablets + 1), {}],
  ["tablet fixo", await qr(1), { screenEmulation: { mobile: true, width: 1280, height: 800, deviceScaleFactor: 1, disabled: false } }]
]) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const { lhr, report } = await lighthouse(url, { port: PORT, output: "html", logLevel: "error", onlyCategories: ["performance"] }, { extends: "lighthouse:default", settings });
    if (lhr.runtimeError) throw new Error(`${name}: ${lhr.runtimeError.message}`);
    const m = (id) => lhr.audits[id].numericValue;
    runs.push({ lcp: m("largest-contentful-paint"), tti: m("interactive"), fcp: m("first-contentful-paint"), tbt: m("total-blocking-time"), score: lhr.categories.performance.score, report });
  }
  runs.sort((a, b) => a.lcp - b.lcp);
  const mid = runs[1];
  writeFileSync(`test-results/lighthouse-${name.split(" ")[0]}.html`, mid.report);
  console.log(`Lighthouse ${name}: LCP ${s(mid.lcp)} · TTI ${s(mid.tti)} · FCP ${s(mid.fcp)} · TBT ${mid.tbt.toFixed(0)} ms · nota ${Math.round(mid.score * 100)} (LCP das 3: ${runs.map((r) => s(r.lcp)).join(", ")}) · meta ${C.metas.cardapioS} s`);
  if (Math.max(mid.lcp, mid.tti) > C.metas.cardapioS * 1000) ok = false;
}
await browser.close();
process.exit(ok ? 0 : 1);
