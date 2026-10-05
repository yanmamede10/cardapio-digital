import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer, request as forward, type Server } from "node:http";
import { extname, join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { R, adminApi, asSuperAdmin, loginAs, newTable, test } from "./fixtures";

// SEG-A05: the fronts' security headers, from each app's vercel.json, on the apps as Vercel serves them — the production
// build, every response with those headers — and a browser walking their screens. (F-5 reads the same build: no restaurant
// name hard-coded in the cardápio's bundle.) Any resource or script the CSP blocks is a
// failure. Each app gets its own origin, with /api/ forwarded to the test API: connect-src 'self' covers it here (in
// production the API is https://<VM>, which connect-src's https: covers).
const API = "http://localhost:4200";
const APPS = { web: 5293, dashboard: 5294 } as const;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const servers: Server[] = [];

/** vercel.json's headers for every path, as an object. */
const vercelHeaders = (app: string) => {
  const rule = (JSON.parse(readFileSync(`apps/${app}/vercel.json`, "utf8")).headers ?? []).find((h: { source: string }) => h.source === "/(.*)");
  return Object.fromEntries((rule?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value])) as Record<string, string>;
};

test.describe.configure({ timeout: 240_000 });

test.beforeAll(async () => {
  for (const [app, port] of Object.entries(APPS)) {
    const env = { ...process.env, VITE_API_URL: `http://localhost:${port}`, VITE_CUSTOMER_APP_URL: `http://localhost:${APPS.web}` };
    execSync("npx vite build --base / --outDir dist/csp --emptyOutDir --logLevel warn", { cwd: `apps/${app}`, env, stdio: "inherit" });
    const dir = `apps/${app}/dist/csp`;
    const headers = vercelHeaders(app);
    const server = createServer((req, res) => {
      if (req.url!.startsWith("/api/")) {
        const up = forward(`${API}${req.url}`, { method: req.method, headers: req.headers }, (r) => (res.writeHead(r.statusCode!, r.headers), r.pipe(res)));
        return void req.pipe(up);
      }
      const asked = join(dir, decodeURIComponent(new URL(req.url!, "http://x").pathname));
      const file = existsSync(asked) && statSync(asked).isFile() ? asked : join(dir, "index.html"); // the SPA rewrite
      res.writeHead(200, { ...headers, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    });
    await new Promise<void>((ok) => server.listen(port, ok));
    servers.push(server);
  }
});
test.afterAll(() => servers.forEach((s) => s.close()));

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

test("os dois vercel.json mandam CSP, nosniff, Referrer-Policy e proibição de moldura", () => {
  for (const app of Object.keys(APPS)) {
    const h = vercelHeaders(app);
    expect(h["Content-Security-Policy"], app).toMatch(/script-src 'self'(;|$)/);
    expect(h["Content-Security-Policy"], app).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"], app).toContain("object-src 'none'");
    expect(h["X-Content-Type-Options"], app).toBe("nosniff");
    expect(h["Referrer-Policy"], app).toBe("no-referrer");
    expect(h["X-Frame-Options"], app).toBe("DENY");
  }
});

test("painel com a CSP: login, as telas do Dono e o Super Admin, nada bloqueado; um script injetado não roda", async ({ page, request }) => {
  const origin = `http://localhost:${APPS.dashboard}`;
  const res = await page.goto(origin);
  expect(res?.headers()["content-security-policy"]).toBe(vercelHeaders("dashboard")["Content-Security-Policy"]);
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
  expect(await blocked(page, origin, screens)).toEqual([]);
});

test("cardápio do cliente com a CSP: delivery, prato e mesa pelo QR, nada bloqueado", async ({ page, api }) => {
  const origin = `http://localhost:${APPS.web}`;
  const item = (await api<{ id: string; soldOut: boolean }[]>("GET", `/api/restaurants/${R}/items`)).find((i) => !i.soldOut)!;
  const table = await newTable(api);
  expect(await blocked(page, origin, ["/", `/r/${R}/menu`, `/r/${R}/item/${item.id}`, `/t/${table.code}`])).toEqual([]);
});

test("o bundle do app do cliente não traz nome de restaurante fixo: nenhum dos restaurantes do banco aparece no código", async ({ request }) => {
  // esbuild escapes non-ASCII (Nó → N\xF3): undo it so names with accents count too.
  const bundle = readdirSync("apps/web/dist/csp/assets")
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(`apps/web/dist/csp/assets/${f}`, "utf8"))
    .join("\n")
    .replace(/\x([0-9a-f]{2})|\u([0-9a-f]{4})/gi, (_, x, u) => String.fromCharCode(parseInt(x ?? u, 16)));
  const names = (await adminApi<{ name: string }[]>(request, "GET", "/restaurants")).map((r) => r.name);
  expect(names).toContain("Fogo & Nó"); // the seed's: the list is the real one
  expect(names.filter((n) => bundle.includes(n))).toEqual([]);
});
