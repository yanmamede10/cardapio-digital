import type { Page } from "@playwright/test";
import { ADMIN_KEY, expect, loginAs, staffToken, tableUrl, test } from "./fixtures";

// UI-01 (docs/testes/plano-de-testes.md): every screen in scope, with every role that sees it, on the three screen
// sizes (Playwright projects desktop/tablet/mobile) and in both themes. A screen fails when the page scrolls sideways,
// throws, or any API call it makes comes back with an error. VARREDURA_FOTOS=1 also saves a full-page screenshot of each
// one in test-results/varredura, for the eye check (contrast, clipping) — off by default, it doubles the time.
const PHOTOS = !!process.env.VARREDURA_FOTOS;
const OPERACAO = ["/", "/mesas", "/mesas/12/pedido", "/cardapio"];
const GESTAO = ["/atendimento", "/produtos", "/relatorios", "/visao-geral", "/contas-a-pagar", "/contas-a-receber", "/financeiro"];
const PHONE_EXTRA = ["/mais", "/mesas/12"];
const ROLES: { user: string; screens: string[]; phoneOnly?: string[] }[] = [
  { user: "dono", screens: [...OPERACAO, ...GESTAO, "/config"], phoneOnly: [...PHONE_EXTRA, "/config/perfil", "/config/horarios", "/config/salao", "/config/equipe", "/config/fiscal", "/config/whatsapp"] },
  { user: "gerente", screens: [...OPERACAO, ...GESTAO], phoneOnly: PHONE_EXTRA },
  { user: "garcom", screens: [...OPERACAO, "/atendimento"], phoneOnly: PHONE_EXTRA },
  { user: "cozinha", screens: OPERACAO, phoneOnly: PHONE_EXTRA }
];

/** Opens a path and checks it; returns what went wrong (empty = fine). */
async function check(page: Page, path: string, shot: string, url = path): Promise<string[]> {
  const problems: string[] = [];
  const onError = (e: Error) => problems.push(`JS: ${e.message}`);
  const onResponse = (r: import("@playwright/test").Response) => {
    if (r.url().startsWith("http://localhost:4200/") && r.status() >= 400) problems.push(`API ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  };
  page.on("pageerror", onError);
  page.on("response", onResponse);
  await page.goto(url);
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 8_000 });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {}); // screens keep polling: idle may never come
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problems.push(`rola ${overflow}px na horizontal`);
  if (PHOTOS) await page.screenshot({ path: `test-results/varredura/${shot}.png`, fullPage: true });
  page.off("pageerror", onError);
  page.off("response", onResponse);
  return problems.map((p) => `${path}: ${p}`);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme });

    for (const role of ROLES) {
      test(`${role.user}: todas as telas do papel`, async ({ page, request }, info) => {
        await loginAs(page, request, `${role.user}@chapa27.example`);
        const screens = [...role.screens, ...(info.project.name === "mobile" ? role.phoneOnly ?? [] : [])];
        const problems: string[] = [];
        for (const path of screens) problems.push(...(await check(page, path, `${info.project.name}-${theme}-${role.user}${path.replace(/\//g, "_")}`)));
        expect(problems).toEqual([]);
      });
    }

    test("login, Super Admin e cardápio do cliente", async ({ page, browser, request }, info) => {
      const shot = (name: string) => `${info.project.name}-${theme}-${name}`;
      const problems: string[] = [];
      await page.addInitScript(() => localStorage.removeItem("cardapio.dashboard.session")); // runs after the fixture's: logged out
      problems.push(...(await check(page, "/", shot("login"))));
      await page.addInitScript((k) => sessionStorage.setItem("mesapronta.adminKey", k), ADMIN_KEY);
      for (const path of ["/admin", "/admin/restaurantes/chapa27", "/admin/mensalidades"]) problems.push(...(await check(page, path, shot(`superadmin${path.replace(/\//g, "_")}`))));

      const guest = await browser.newContext({ viewport: page.viewportSize()!, colorScheme: theme, isMobile: info.project.name === "mobile", hasTouch: info.project.name !== "desktop" });
      const g = await guest.newPage();
      problems.push(...(await check(g, "cliente: QR da mesa", shot("cliente-menu"), await tableUrl(request, await staffToken(request, "garcom@chapa27.example"), "chapa27", 3))));
      await g.getByText("Cheddar & Bacon", { exact: true }).first().click();
      await expect(g.getByRole("button", { name: /Adicionar ao carrinho/ })).toBeVisible();
      const overflow = await g.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`cliente: item rola ${overflow}px na horizontal`);
      if (PHOTOS) await g.screenshot({ path: `test-results/varredura/${shot("cliente-item")}.png` });
      await guest.close();
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
