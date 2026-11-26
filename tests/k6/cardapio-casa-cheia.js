// Grafana k6 — o cardápio da mesa numa casa cheia (atividade "Ferramentas de QA").
//
// Endpoint crítico: o cardápio aberto pelo QR. Cada celular que lê o QR carrega o restaurante, as categorias e os pratos e,
// enquanto a pessoa escolhe, abre pratos e consulta de novo a disponibilidade (o app faz isso a cada 12 s). Se essa leitura
// ficar lenta, a mesa inteira espera para pedir.
//
// Rodar: npm run test:k6 (tests/run.mjs sobe o Postgres de teste, as seeds e a API em :4200 e chama o k6).
// Sozinho, contra uma API já no ar: k6 run -e API_URL=http://localhost:4200 tests/k6/cardapio-casa-cheia.js
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

const API = __ENV.API_URL || "http://localhost:4200";
const R = "chapa27"; // seed de demonstração: 30 mesas
const MESAS = 30;

// O tempo do cardápio completo (as 3 chamadas da abertura), além do http_req_duration de cada requisição.
const aberturaDoCardapio = new Trend("abertura_do_cardapio", true);

export const options = {
  scenarios: {
    casa_cheia: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 60 }, // o salão enche
        { duration: "1m", target: 120 }, // pico: 30 mesas × 4 celulares
        { duration: "30s", target: 120 },
        { duration: "20s", target: 0 } // as mesas vão embora
      ],
      gracefulRampDown: "10s"
    }
  },
  // Critérios de aceite: com a casa cheia, 95% das leituras em menos de 500 ms, o cardápio inteiro abre em menos de 1,5 s
  // (p95) e menos de 1% de erro. Se algum falhar, o k6 sai com código de erro e o job do CI reprova.
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    "http_req_duration{tipo:pratos}": ["p(95)<500"],
    abertura_do_cardapio: ["p(95)<1500"],
    checks: ["rate>0.99"]
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"]
};

/** Uma vez, antes da carga: entra como dono e lê o QR de cada mesa (o que cada celular teria escaneado). */
export function setup() {
  const login = http.post(`${API}/api/auth/login`, JSON.stringify({ email: `dono@${R}.example`, password: __ENV.SENHA || "senha123" }), {
    headers: { "Content-Type": "application/json" }
  });
  if (login.status !== 200) throw new Error(`login falhou: ${login.status} ${login.body}`);
  const auth = { headers: { Authorization: `Bearer ${login.json("token")}` } };
  const qrs = [];
  for (let mesa = 1; mesa <= MESAS; mesa++) {
    const r = http.get(`${API}/api/restaurants/${R}/tables/${mesa}/qr`, auth);
    if (r.status === 200) qrs.push(r.json("tableCode"));
  }
  if (!qrs.length) throw new Error("nenhuma mesa com QR no seed");
  return { qrs };
}

export default function ({ qrs }) {
  // Cada usuário virtual é um celular numa mesa: o cabeçalho da mesa conta no limite por mesa da API (900/min).
  const qr = qrs[(__VU - 1) % qrs.length];
  const params = (tipo) => ({ headers: { "X-Table-Code": qr }, tags: { tipo } });

  group("abrir o cardápio pelo QR", () => {
    const inicio = Date.now();
    const respostas = http.batch([
      ["GET", `${API}/api/tables/${qr}`, null, params("mesa")],
      ["GET", `${API}/api/restaurants/${R}`, null, params("restaurante")],
      ["GET", `${API}/api/restaurants/${R}/categories`, null, params("categorias")],
      ["GET", `${API}/api/restaurants/${R}/items`, null, params("pratos")]
    ]);
    aberturaDoCardapio.add(Date.now() - inicio);
    check(respostas[0], { "mesa do QR: 200": (r) => r.status === 200 });
    check(respostas[1], { "restaurante: 200": (r) => r.status === 200 });
    check(respostas[3], {
      "pratos: 200": (r) => r.status === 200,
      "pratos: lista com itens": (r) => Array.isArray(r.json()) && r.json().length > 0
    });
  });

  // A pessoa lê o cardápio, abre um prato e o app volta a perguntar a disponibilidade.
  sleep(2 + Math.random() * 3);
  group("olhar um prato e atualizar a disponibilidade", () => {
    const pratos = http.get(`${API}/api/restaurants/${R}/items`, params("pratos"));
    const lista = pratos.status === 200 ? pratos.json() : [];
    if (lista.length) {
      const prato = lista[Math.floor(Math.random() * lista.length)];
      const r = http.get(`${API}/api/restaurants/${R}/items/${prato.id}`, params("prato"));
      check(r, { "prato: 200": (x) => x.status === 200 });
    }
  });
  sleep(3 + Math.random() * 4);
}

/** Resumo legível para o relatório (reports/k6-resumo.md) e o JSON completo (reports/k6-resumo.json). */
export function handleSummary(data) {
  const ms = (v) => (v === undefined ? "—" : `${v.toFixed(1)} ms`);
  const t = (nome) => data.metrics[nome]?.values ?? {};
  const linha = (nome, rotulo) => {
    const v = t(nome);
    return `| ${rotulo} | ${ms(v.avg)} | ${ms(v.med)} | ${ms(v["p(90)"])} | ${ms(v["p(95)"])} | ${ms(v["p(99)"])} | ${ms(v.max)} |`;
  };
  const limites = Object.entries(data.metrics)
    .filter(([, m]) => m.thresholds)
    .flatMap(([nome, m]) => Object.entries(m.thresholds).map(([regra, r]) => `| \`${nome}\` | \`${regra}\` | ${r.ok ? "✅ passou" : "❌ falhou"} |`));
  const req = t("http_reqs");
  const md = [
    "# k6 — cardápio da mesa com a casa cheia",
    "",
    `- Requisições: ${req.count} (${(req.rate ?? 0).toFixed(1)}/s) · iterações: ${t("iterations").count} · VUs no pico: ${t("vus_max").max}`,
    `- Erros HTTP: ${((t("http_req_failed").rate ?? 0) * 100).toFixed(2)}% · checks aprovados: ${((t("checks").rate ?? 0) * 100).toFixed(2)}%`,
    "",
    "| Medida | Média | Mediana | p90 | p95 | p99 | Máx |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    linha("http_req_duration", "Qualquer requisição"),
    linha("http_req_duration{tipo:pratos}", "GET pratos"),
    linha("abertura_do_cardapio", "Abertura do cardápio (4 chamadas)"),
    "",
    "| Métrica | Limite | Resultado |",
    "| --- | --- | --- |",
    ...limites,
    ""
  ].join("\n");
  return { stdout: md, "reports/k6-resumo.md": md, "reports/k6-resumo.json": JSON.stringify(data, null, 2) };
}
