import type { Page } from "@playwright/test";
import { a11yProblems } from "./a11y";
import { ADMIN_KEY, expect, loginAs, staffToken, tableUrl, test } from "./fixtures";

// UI-01 + UX-03 (docs/testes/plano-de-testes.md): every screen in scope — the dashboard with every role that sees it, and the
// customer app at a table and on delivery — on the three screen sizes (Playwright projects desktop/tablet/mobile) and in both
// themes. A screen fails when the page scrolls sideways, throws, an API call it makes comes back with an error, axe finds a
// WCAG 2.1 A/AA violation (contrast, names of buttons/links/fields…) or a touch target is under 44 × 44 (tests/e2e/a11y.ts; these
// two on desktop and phone).
// VARREDURA_FOTOS=1 also saves a full-page screenshot of each one in test-results/varredura, for the eye check.
const PHOTOS = !!process.env.VARREDURA_FOTOS;
const API = "http://localhost:4200";
const WEB = "http://localhost:5273";
const OPERACAO = ["/", "/mesas", "/mesas/12/pedido", "/mesas/qr?mesa=12", "/cardapio"];
const GESTAO = ["/atendimento", "/produtos", "/relatorios", "/visao-geral", "/contas-a-pagar", "/contas-a-receber", "/financeiro"];
const PHONE_EXTRA = ["/mais", "/mesas/12"];
const ROLES: { user: string; screens: string[]; phoneOnly?: string[] }[] = [
  { user: "dono", screens: [...OPERACAO, ...GESTAO, "/config"], phoneOnly: [...PHONE_EXTRA, "/config/perfil", "/config/horarios", "/config/salao", "/config/equipe", "/config/fiscal", "/config/whatsapp"] },
  { user: "gerente", screens: [...OPERACAO, ...GESTAO], phoneOnly: PHONE_EXTRA },
  { user: "garcom", screens: [...OPERACAO, "/atendimento"], phoneOnly: PHONE_EXTRA },
  { user: "cozinha", screens: OPERACAO, phoneOnly: PHONE_EXTRA }
];

/** Checks the page as it is (after opening `url`, when given); returns what went wrong (empty = fine). */
async function check(page: Page, path: string, shot: string, url: string | null = path, { apiErrors = true } = {}): Promise<string[]> {
  // UX-03 asks for desktop and phone; the tablet keeps the layout checks (and the sweep stays inside CI's time).
  const a11y = !shot.startsWith("tablet-");
  const problems: string[] = [];
  const onError = (e: Error) => problems.push(`JS: ${e.message}`);
  const onResponse = (r: import("@playwright/test").Response) => {
    if (apiErrors && r.url().startsWith(`${API}/`) && r.status() >= 400) problems.push(`API ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  };
  page.on("pageerror", onError);
  page.on("response", onResponse);
  if (url) await page.goto(url);
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 8_000 });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {}); // screens keep polling: idle may never come
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problems.push(`rola ${overflow}px na horizontal`);
  if (PHOTOS) await page.screenshot({ path: `test-results/varredura/${shot}.png`, fullPage: true });
  page.off("pageerror", onError);
  page.off("response", onResponse);
  return [...problems.map((p) => `${path}: ${p}`), ...(a11y ? await a11yProblems(page, path) : [])];
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme });

    for (const role of ROLES) {
      test(`${role.user}: todas as telas do papel`, async ({ page, request }, info) => {
        test.setTimeout(120_000); // up to 22 screens, each with axe
        await loginAs(page, request, `${role.user}@chapa27.example`);
        const screens = [...role.screens, ...(info.project.name === "mobile" ? role.phoneOnly ?? [] : [])];
        const problems: string[] = [];
        for (const path of screens) problems.push(...(await check(page, path, `${info.project.name}-${theme}-${role.user}${path.replace(/[/?=]/g, "_")}`)));
        expect(problems).toEqual([]);
      });
    }

    test("login e Super Admin", async ({ page }, info) => {
      test.setTimeout(60_000);
      const shot = (name: string) => `${info.project.name}-${theme}-${name}`;
      const problems: string[] = [];
      await page.addInitScript(() => localStorage.removeItem("cardapio.dashboard.session")); // runs after the fixture's: logged out
      problems.push(...(await check(page, "/", shot("login"))));
      await page.addInitScript((k) => sessionStorage.setItem("mesapronta.adminKey", k), ADMIN_KEY);
      for (const path of ["/admin", "/admin/restaurantes/chapa27", "/admin/mensalidades"]) problems.push(...(await check(page, path, shot(`superadmin${path.replace(/\//g, "_")}`))));
      expect(problems).toEqual([]);
    });

    test("cardápio do cliente: todas as telas, na mesa e no delivery", async ({ browser, request, page }, info) => {
      test.setTimeout(120_000);
      const shot = (name: string) => `${info.project.name}-${theme}-cliente-${name}`;
      const device = { viewport: page.viewportSize()!, colorScheme: theme, isMobile: info.project.name === "mobile", hasTouch: info.project.name !== "desktop" };
      const staff = await staffToken(request, "dono@chapa27.example");
      const auth = { headers: { Authorization: `Bearer ${staff}` } };
      const problems: string[] = [];

      // At a table (QR): menu, dish, cart, review, the order waiting for the restaurant and refused.
      await request.post(`${API}/api/restaurants/chapa27/tables/2/close`, auth);
      const atTable = await browser.newContext(device);
      const g = await atTable.newPage();
      problems.push(...(await check(g, "cliente mesa: QR inválido", shot("qr-invalido"), `${WEB}/t/codigo-que-nao-existe`, { apiErrors: false })));
      problems.push(...(await check(g, "cliente mesa: cardápio", shot("mesa-cardapio"), await tableUrl(request, staff, "chapa27", 2))));
      await g.getByText("Cheddar & Bacon", { exact: true }).first().click();
      await expect(g.getByRole("button", { name: /Adicionar ao carrinho/ })).toBeVisible();
      problems.push(...(await check(g, "cliente mesa: prato", shot("mesa-prato"), null)));
      await g.getByRole("button", { name: /Adicionar ao carrinho/ }).click();
      await g.getByRole("button", { name: /Ver carrinho/ }).click();
      problems.push(...(await check(g, "cliente mesa: carrinho", shot("mesa-carrinho"), null)));
      await g.getByRole("button", { name: /Enviar pedido para a cozinha/ }).click();
      problems.push(...(await check(g, "cliente mesa: revisão", shot("mesa-revisao"), null)));
      await g.getByRole("button", { name: /Confirmar e enviar para a cozinha/ }).click();
      await expect(g.getByText("Aguardando confirmação do restaurante")).toBeVisible();
      problems.push(...(await check(g, "cliente mesa: aguardando", shot("mesa-aguardando"), null)));
      const orderId = g.url().split("/order/")[1];
      await request.post(`${API}/api/orders/${orderId}/reject`, auth);
      await expect(g.getByText("Pedido não confirmado. Chame o garçom.")).toBeVisible({ timeout: 8_000 });
      problems.push(...(await check(g, "cliente mesa: recusado", shot("mesa-recusado"), null)));
      await atTable.close();

      // Delivery: restaurants, menu, cart, checkout, review, the order's status and the history.
      const home = await browser.newContext(device);
      const d = await home.newPage();
      problems.push(...(await check(d, "cliente delivery: restaurantes", shot("delivery-inicio"), `${WEB}/`)));
      problems.push(...(await check(d, "cliente delivery: cardápio", shot("delivery-cardapio"), `${WEB}/r/chapa27/menu`)));
      await d.getByRole("button", { name: "Adicionar Polenta Frita ao pedido" }).first().click();
      await d.getByRole("button", { name: /Ver carrinho/ }).click();
      problems.push(...(await check(d, "cliente delivery: carrinho", shot("delivery-carrinho"), null)));
      await d.getByRole("button", { name: /Ir para pagamento/ }).click();
      problems.push(...(await check(d, "cliente delivery: pagamento", shot("delivery-pagamento"), null)));
      await d.getByRole("button", { name: /Revisar pedido/ }).click();
      problems.push(...(await check(d, "cliente delivery: revisão", shot("delivery-revisao"), null)));
      await d.getByRole("button", { name: /Confirmar pedido/ }).click();
      await expect(d).toHaveURL(/\/order\//);
      problems.push(...(await check(d, "cliente delivery: pedido", shot("delivery-pedido"), null)));
      await request.post(`${API}/api/orders/${d.url().split("/order/")[1]}/reject`, auth); // leaves the Central clean
      problems.push(...(await check(d, "cliente delivery: meus pedidos", shot("delivery-historico"), `${WEB}/history`)));
      await home.close();
      expect(problems).toEqual([]);
    });
  });
}

test("Central de Pedidos: as quatro colunas cabem inteiras na tela (desktop 1366 e tablet 1280)", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "o celular tem a própria Central, em abas");
  await page.goto("/");
  for (const label of ["Recebido", "Preparando", "Pronto", "Entregue / Servido"]) {
    const box = (await page.locator("section").filter({ has: page.getByText(label, { exact: true }) }).first().boundingBox())!;
    expect(box.x + box.width, label).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});
