import { execFileSync, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { get as httpGet, createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { R, adminApi, asSuperAdmin, loginAs, newTable, test } from "./fixtures";

// The production stack on this machine, as the VM runs it (docs/adr/0011-fronts-no-caddy.md): deploy/docker-compose.prod.yml's
// caddy — the two fronts built into its image by deploy/caddy.Dockerfile — and api, with CADDY_TLS=internal and
// PUBLIC_URL=https://127.0.0.1. Built from a copy of this working tree with its own deploy/.env, as the VM's clone is: a real
// deploy/.env here is never read. The stack's API has no database (/api/health doesn't need one); the screens' API calls are
// answered by the test API (:4200, the seeded database) through page.route, and everything else the browser gets is Caddy's.
// SEG-A05 (the fronts' CSP and security headers, once vercel.json's) and F-5 (no restaurant name in the cardápio's bundle) are
// checked on what Caddy serves.
const PUBLIC_URL = "https://127.0.0.1";
const API = "http://localhost:4200";
const PROJECT = "cardapio-teste"; // never the VM's project, "cardapio"
const APK_PORT = 5295; // the APK's page (https://localhost on the phone) stands here
const STACK_ENV: Record<string, string> = {
  PUBLIC_URL,
  CADDY_TLS: "internal",
  NODE_ENV: "production",
  JWT_SECRET: "teste-da-pilha-".padEnd(48, "x"),
  SUPER_ADMIN_KEY: "",
  // Nothing listens there: what needs the database answers 500, the rest of the API works.
  DATABASE_URL: "postgresql://sem:banco@127.0.0.1:1/nenhum",
  DIRECT_URL: "postgresql://sem:banco@127.0.0.1:1/nenhum",
  EVOLUTION_API_KEY: "k".repeat(64),
  WHATSAPP_WEBHOOK_SECRET: "teste",
  STORAGE_S3_ENDPOINT: "https://storage.invalid",
  STORAGE_S3_REGION: "us-east-1",
  STORAGE_S3_ACCESS_KEY_ID: "teste",
  STORAGE_S3_SECRET_ACCESS_KEY: "teste",
  STORAGE_S3_BUCKET: "cardapio",
  STORAGE_PUBLIC_URL: "https://storage.invalid/cardapio",
  STORAGE_S3_WHATSAPP_BUCKET: "whatsapp-media"
};
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

let dir = "";
let ca = "";
let apk: Server | undefined;
const compose = (...args: string[]) => {
  // Compose prefers the process's variables over deploy/.env: npm test's own (an empty STORAGE_S3_BUCKET…) must not reach it.
  const env = { ...process.env };
  for (const k of Object.keys(STACK_ENV)) delete env[k];
  return execFileSync("docker", ["compose", "-p", PROJECT, "-f", join(dir, "deploy/docker-compose.prod.yml"), ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 << 20 });
};

type Res = { status: number; headers: IncomingHttpHeaders; body: string };
/** A request to the stack over HTTPS, checking the certificate against Caddy's local CA (no SNI: it's an IP, as for a browser). */
const https = (path: string, { method = "GET", headers = {}, body }: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
  new Promise<Res>((ok, fail) => {
    const req = httpsRequest(`${PUBLIC_URL}${path}`, { method, headers, ca }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c)).on("end", () => ok({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", fail).end(body);
  });

/** The screens' API calls at `origin`/api go to the test API instead. */
const toTestApi = (page: Page, origin = PUBLIC_URL) =>
  page.route(`${origin}/api/**`, async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(origin, API) }) }));

test.describe.configure({ timeout: 240_000 });
test.use({ ignoreHTTPSErrors: true }); // the browser doesn't know Caddy's local CA; the certificate is checked by https() above

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000); // two images built from scratch on the CI
  for (const port of [80, 443]) {
    const taken = await new Promise((resolve) => {
      const socket = connect({ port, host: "127.0.0.1" });
      socket.once("connect", () => (socket.destroy(), resolve(true))).once("error", () => resolve(false));
    });
    if (taken) throw new Error(`A porta ${port} está ocupada: a pilha de produção precisa da 80 e da 443.`);
  }
  // What the VM's clone has: the tracked files (and new ones not yet committed) of the build context.
  dir = mkdtempSync(join(tmpdir(), "cardapio-pilha-"));
  const files = execSync("git ls-files -z --cached --others --exclude-standard", { encoding: "utf8" }).split("\0");
  for (const f of files.filter((f) => /^(package(-lock)?\.json|\.dockerignore|apps\/|packages\/|deploy\/)/.test(f) && !/^apps\/[^/]+\/android\//.test(f) && existsSync(f))) {
    mkdirSync(join(dir, dirname(f)), { recursive: true });
    cpSync(f, join(dir, f));
  }
  writeFileSync(join(dir, "deploy/.env"), Object.entries(STACK_ENV).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  compose("up", "-d", "--build", "--wait", "--wait-timeout", "180", "caddy", "api");
  for (let i = 0; !ca; i++) {
    try {
      ca = compose("exec", "-T", "caddy", "cat", "/data/caddy/pki/authorities/local/root.crt");
    } catch {
      if (i > 30) throw new Error("O Caddy não criou a CA local");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
});

test.afterAll(() => {
  apk?.close();
  if (!dir) return;
  try {
    compose("down", "-v", "--remove-orphans");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Opens each path and returns what the CSP blocked (the browser reports each block as a console error). */
async function blocked(page: Page, origin: string, paths: string[]) {
  const found: string[] = [];
  page.on("console", (m) => m.type() === "error" && /Content Security Policy/i.test(m.text()) && found.push(`${page.url()}: ${m.text()}`));
  for (const path of paths) {
    await page.goto(`${origin}${path}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 8_000 });
  }
  return found;
}

const front = (headers: IncomingHttpHeaders) => {
  expect(headers["content-security-policy"]).toMatch(/script-src 'self'(;|$)/); // no 'unsafe-inline': an injected script doesn't run
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-frame-options"]).toBe("DENY");
};
const script = (html: string) => html.match(/<script type="module" crossorigin src="([^"]+)"/)![1];

test("a pilha local responde como a VM: cardápio em /, painel em /painel/, API em /api/, cada rota interna recarregada com o index do seu app", async () => {
  const web = await https("/");
  expect([web.status, web.headers["content-type"]]).toEqual([200, "text/html; charset=utf-8"]);
  expect(web.body).toContain("<title>Cardápio Digital</title>");
  expect(script(web.body)).toMatch(/^\/assets\/index-\w+\.js$/);
  const painel = await https("/painel/");
  expect(painel.status).toBe(200);
  expect(painel.body).toContain("<title>MesaPronta · Gestão</title>");
  expect(script(painel.body)).toMatch(/^\/painel\/assets\/index-[\w-]+\.js$/);

  // A reload of an address the app routes by itself: its own app's index.html, never a 404 nor the other app.
  for (const path of ["/painel/mesas", "/painel/admin/mensalidades", "/painel/rota-que-nao-existe"]) expect((await https(path)).body, path).toBe(painel.body);
  for (const path of ["/t/qualquer-codigo", `/r/${R}/menu`, "/history"]) expect((await https(path)).body, path).toBe(web.body);
  const slashless = await https("/painel");
  expect([slashless.status, slashless.headers.location]).toEqual([301, "/painel/"]);

  const health = await https("/api/health");
  expect([health.status, health.body]).toEqual([200, '{"ok":true}']);
  expect(health.headers["content-security-policy"], "a API manda a sua, não a dos fronts").toBe("default-src 'none'; frame-ancestors 'none'");
  const unknown = await https("/api/nao-existe");
  expect([unknown.status, unknown.headers["content-type"]]).toEqual([404, "application/json; charset=utf-8"]);

  // HTTP only redirects (Caddy's automatic HTTPS).
  const http = await new Promise<{ status?: number; location?: string }>((ok, fail) => httpGet("http://127.0.0.1/painel/mesas", (r) => ok({ status: r.statusCode, location: r.headers.location })).on("error", fail));
  expect(http).toEqual({ status: 308, location: `${PUBLIC_URL}/painel/mesas` });
});

test("cabeçalhos dos fronts no Caddy: a CSP e os demais em toda resposta; asset com hash guardado um ano, index.html sempre conferido", async () => {
  for (const app of ["/", "/painel/"]) {
    const index = await https(app);
    front(index.headers);
    expect(index.headers["cache-control"], `${app} index.html`).toBe("no-cache");
    expect((await https(`${app}mesas`)).headers["cache-control"], `${app}mesas`).toBe("no-cache");
    const asset = await https(script(index.body), { headers: { "Accept-Encoding": "gzip" } });
    expect([asset.status, asset.headers["content-type"]], script(index.body)).toEqual([200, "text/javascript; charset=utf-8"]);
    expect(asset.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(asset.headers["content-encoding"], "comprimido").toBe("gzip");
    front(asset.headers);
    // A file that isn't there (an old hash) gets the index like any address, and is not kept a year.
    const missing = await https(`${app}assets/index-naoexiste.js`);
    expect([missing.body, missing.headers["cache-control"]]).toEqual([index.body, "no-cache"]);
  }
});

test("pela pilha, CORS aceita só o próprio endereço e o APK, e o IP do cliente é sempre o que conectou no Caddy (CF-Connecting-IP forjado não vale)", async () => {
  for (const [origin, allowed] of [[PUBLIC_URL, PUBLIC_URL], ["https://localhost", "https://localhost"], ["https://outro-site.example", undefined]] as const)
    expect((await https("/api/health", { headers: { Origin: origin } })).headers["access-control-allow-origin"], origin).toBe(allowed);
  // 50 logins per IP in 15 min (apps/api/src/lib/rateLimit.ts). Each attempt "comes from" another IP; Caddy overwrites the header
  // with who connected, so they all count for the same one and the 51st is refused. (Without a database the first 50 are 500.)
  const statuses: number[] = [];
  for (let i = 1; i <= 51; i++)
    statuses.push((await https("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": `198.51.100.${i}` }, body: JSON.stringify({ email: `ip${i}@teste.example`, password: "x" }) })).status);
  expect(statuses.slice(0, 50).every((s) => s !== 429)).toBe(true);
  expect(statuses[50]).toBe(429);
});

test("painel pelo Caddy, com a CSP: login, as telas do Dono e o Super Admin, nada bloqueado; um script injetado não roda", async ({ page, request }) => {
  await toTestApi(page);
  const res = await page.goto(`${PUBLIC_URL}/painel/`);
  front(res!.headers());
  // What an XSS would do — a script element put in the page — must not run: proof the policy is on (script-src without
  // 'unsafe-inline'). Not eval through page.evaluate: DevTools' own evaluation is exempt from the page's CSP.
  const injected = await page.evaluate(async () => {
    const s = document.createElement("script");
    s.textContent = "window.injetado = true";
    document.head.append(s);
    await new Promise((r) => setTimeout(r, 100));
    return (window as unknown as { injetado?: boolean }).injetado === true;
  });
  expect(injected).toBe(false);
  await loginAs(page, request, "marina@fogoeno.com.br");
  await asSuperAdmin(page);
  const screens = ["/", "/mesas", "/mesas/qr", "/cardapio", "/promocoes", "/atendimento", "/produtos", "/relatorios", "/visao-geral", "/contas-a-pagar", "/financeiro", "/config", "/admin"];
  expect(await blocked(page, PUBLIC_URL, screens.map((s) => `/painel${s}`))).toEqual([]);
  // Reloaded deep in the dashboard, it is still the dashboard, on the same screen.
  await page.goto(`${PUBLIC_URL}/painel/mesas`);
  await expect(page).toHaveURL(`${PUBLIC_URL}/painel/mesas`);
  await expect(page).toHaveTitle(/^Mesas · /);
});

test("cardápio do cliente pelo Caddy, com a CSP: delivery, prato e mesa pelo QR, nada bloqueado", async ({ page, api }) => {
  await toTestApi(page);
  const item = (await api<{ id: string; soldOut: boolean }[]>("GET", `/api/restaurants/${R}/items`)).find((i) => !i.soldOut)!;
  const table = await newTable(api);
  expect(await blocked(page, PUBLIC_URL, ["/", `/r/${R}/menu`, `/r/${R}/item/${item.id}`, `/t/${table.code}`])).toEqual([]);
});

test("o link do QR é o PUBLIC_URL: no painel servido pelo Caddy e no build do APK, que roda em outra origem e chama ${PUBLIC_URL}/api", async ({ browser, request, api }) => {
  const { number, code } = await newTable(api);
  const qrLink = (page: Page) => page.locator(".mono").filter({ hasText: "/t/" });

  const web = await browser.newPage({ ignoreHTTPSErrors: true });
  await toTestApi(web);
  await loginAs(web, request, "marina@fogoeno.com.br");
  await web.goto(`${PUBLIC_URL}/painel/mesas/qr?mesa=${number}`);
  await expect(qrLink(web)).toHaveText(`${PUBLIC_URL}/t/${code}`);
  await web.close();

  // The APK's build (vite --mode android, base /) with the same PUBLIC_URL, served at the root of another origin as the phone
  // serves it at https://localhost: its API calls go to PUBLIC_URL, and the QR is PUBLIC_URL, not the page's origin.
  execSync("npx vite build --mode android --outDir dist/apk --emptyOutDir --logLevel warn", { cwd: "apps/dashboard", env: { ...process.env, VITE_PUBLIC_URL: PUBLIC_URL }, stdio: "inherit" });
  apk = createServer((req, res) => {
    const asked = join("apps/dashboard/dist/apk", decodeURIComponent(new URL(req.url!, "http://x").pathname));
    const file = existsSync(asked) && statSync(asked).isFile() ? asked : "apps/dashboard/dist/apk/index.html"; // the WebView's own fallback
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  await new Promise<void>((ok) => apk!.listen(APK_PORT, ok));
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const called: string[] = [];
  page.on("request", (r) => r.url().includes("/api/") && called.push(new URL(r.url()).origin));
  await toTestApi(page);
  await loginAs(page, request, "marina@fogoeno.com.br");
  await page.goto(`http://localhost:${APK_PORT}/mesas/qr?mesa=${number}`);
  await expect(qrLink(page)).toHaveText(`${PUBLIC_URL}/t/${code}`);
  expect(new Set(called)).toEqual(new Set([PUBLIC_URL]));
  await page.close();
});

test("o bundle do cardápio que o Caddy serve não traz nome de restaurante fixo: nenhum dos restaurantes do banco aparece no código", async ({ request }) => {
  // esbuild escapes non-ASCII (Nó → N\xF3): undo it so names with accents count too.
  const bundle = compose("exec", "-T", "caddy", "sh", "-c", "cat /srv/web/assets/*.js").replace(/\x([0-9a-f]{2})|\u([0-9a-f]{4})/gi, (_, x, u) => String.fromCharCode(parseInt(x ?? u, 16)));
  expect(bundle.length).toBeGreaterThan(100_000);
  const names = (await adminApi<{ name: string }[]>(request, "GET", "/restaurants")).map((r) => r.name);
  expect(names).toContain("Fogo & Nó"); // the seed's: the list is the real one
  expect(names.filter((n) => bundle.includes(n))).toEqual([]);
});
