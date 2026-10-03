import { a11yProblems } from "./a11y";
import { DEMO_MODULES, asSuperAdmin, expect, loginAs, setModules, staffToken, tableUrl, test } from "./fixtures";

// UX-05: an address nobody knows gets a page that says so, instead of a silent jump to the start — the dashboard logged in
// (A1–A4 of the design), the Super Admin, logged out (B1–B4) and the customer's cardápio outside a table (C1–C4). Desktop and
// phone (Playwright projects), both themes; each 404 also goes through axe and the 44 × 44 targets (tests/e2e/a11y.ts).
const WEB = "http://localhost:5273";
const R = "Chapa 27 Burgers";
const LOST = "/pagina-que-nao-existe";
const TITLE = "Esta página não existe";

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme });

    test("U-1 · logado: rota inexistente mostra a 404 para cada papel — título da aba, nada ativo no menu, e o botão leva ao início do papel", async ({ page, request }, info) => {
      test.setTimeout(120_000);
      const mobile = info.project.name === "mobile";
      const current = page.locator('nav [aria-current="page"]'); // the active item of the sidebar (desktop) or of the tab bar (phone)
      // The role's start (homePath): the Central for every role; with Pedidos, Cardápio and Mesas off, the first screen that role sees.
      const noFloor = DEMO_MODULES.filter((m) => !["pedidos", "cardapio", "mesas"].includes(m));
      const cases: [string, string[], string][] = [
        ["dono", DEMO_MODULES, "/"],
        ["gerente", DEMO_MODULES, "/"],
        ["garcom", DEMO_MODULES, "/"],
        ["cozinha", DEMO_MODULES, "/"],
        ["dono", noFloor, "/promocoes"],
        ["gerente", noFloor, "/promocoes"],
        ["garcom", noFloor, "/atendimento"]
      ];
      const problems: string[] = [];
      try {
        for (const [user, modules, home] of cases) {
          const who = `${user} (${home})`;
          await setModules(request, modules, "chapa27");
          await loginAs(page, request, `${user}@chapa27.example`); // the last session put in wins
          await page.goto(LOST);
          await expect(page.getByText(TITLE), who).toBeVisible();
          expect(new URL(page.url()).pathname, `${who}: fica no endereço digitado`).toBe(LOST);
          await expect(page, who).toHaveTitle(`Página não encontrada · ${R}`);
          await expect(page.getByText("Página não encontrada", { exact: true }), `${who}: cabeçalho`).toBeVisible();
          if (mobile) await expect(page.getByText(R, { exact: true }), `${who}: subtítulo`).toBeVisible();
          await expect(current, `${who}: nada ativo no menu`).toHaveCount(0);
          problems.push(...(await a11yProblems(page, `${who} ${LOST}`)));
          await page.getByRole("link", { name: "Voltar ao início" }).click();
          await expect.poll(() => new URL(page.url()).pathname, `${who}: início do papel`).toBe(home);
          await expect(current, `${who}: no início, o menu marca a tela`).toHaveCount(1);
        }
      } finally {
        await setModules(request, DEMO_MODULES, "chapa27");
      }
      expect(problems).toEqual([]);
    });

    test("U-1 · Super Admin: rota inexistente em /admin mostra a 404 e volta ao início do Super Admin", async ({ page }) => {
      await asSuperAdmin(page);
      await page.goto("/admin/pagina-que-nao-existe");
      await expect(page.getByText(TITLE)).toBeVisible();
      await expect(page).toHaveTitle("Página não encontrada · Super Admin");
      expect(await a11yProblems(page, "/admin/pagina-que-nao-existe")).toEqual([]);
      await page.getByRole("link", { name: "Voltar ao início" }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/admin");
      await expect(page.getByRole("heading", { name: "Restaurantes" })).toBeVisible();
    });

    test("U-1 · rota restrita para o papel (cozinha em /config) não cai na 404", async ({ page, request }) => {
      await loginAs(page, request, "cozinha@chapa27.example");
      await page.goto("/config");
      await expect(page).toHaveTitle(`Configurações · ${R}`);
      await expect(page.getByText(TITLE)).toHaveCount(0);
    });

    test("U-2 · sem login: rota inexistente mostra o cartão com \"Entrar\"; rota válida vai para o login", async ({ page }) => {
      await page.addInitScript(() => localStorage.removeItem("cardapio.dashboard.session")); // runs after the fixture's: logged out
      await page.goto(LOST);
      await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
      await expect(page).toHaveTitle("Página não encontrada · MesaPronta Gestão");
      expect(await a11yProblems(page, `sem login ${LOST}`)).toEqual([]);
      await page.getByRole("link", { name: "Entrar" }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/");
      await expect(page.getByLabel("E-mail")).toBeVisible();
      for (const path of ["/mesas", "/config"]) {
        await page.goto(path);
        await expect(page.getByLabel("E-mail"), `${path}: login`).toBeVisible();
        await expect(page.getByText(TITLE), path).toHaveCount(0);
        expect(new URL(page.url()).pathname, path).toBe(path);
      }
    });

    test("U-3 · cardápio: link inexistente fora da mesa mostra \"Link não encontrado\"; na mesa volta ao cardápio da mesa; QR inválido continua em \"Mesa não encontrada\"", async ({ browser, request, page }, info) => {
      const phone = info.project.name === "mobile";
      const device = { viewport: page.viewportSize()!, colorScheme: theme, isMobile: phone, hasTouch: phone };
      // Outside a table (a link someone sent, a typo): the 404 of the cardápio.
      const outside = await browser.newContext(device);
      const guest = await outside.newPage();
      await guest.goto(`${WEB}/link-que-nao-existe`);
      await expect(guest.getByRole("heading", { name: "Link não encontrado" })).toBeVisible();
      await expect(guest.getByText("Para fazer seu pedido, escaneie o QR code da mesa ou chame um atendente.")).toBeVisible();
      await expect(guest).toHaveTitle("Link não encontrado · Cardápio Digital");
      expect(await a11yProblems(guest, "cardápio /link-que-nao-existe")).toEqual([]);
      // A QR that doesn't exist is another screen, unchanged.
      await guest.goto(`${WEB}/t/codigo-que-nao-existe`);
      await expect(guest.getByText("Mesa não encontrada. Confira o código do QR ou chame um atendente.")).toBeVisible();
      await expect(guest.getByText("Link não encontrado")).toHaveCount(0);
      await outside.close();
      // At a table: a wrong link goes back to that table's menu, as before.
      const atTable = await browser.newContext(device);
      const diner = await atTable.newPage();
      await diner.goto(await tableUrl(request, await staffToken(request, "dono@chapa27.example"), "chapa27", 4));
      await expect(diner).toHaveURL(/\/r\/chapa27\/menu$/);
      await diner.goto(`${WEB}/link-que-nao-existe`);
      await expect(diner).toHaveURL(/\/r\/chapa27\/menu$/);
      await expect(diner.getByText("Link não encontrado")).toHaveCount(0);
      await atTable.close();
    });
  });
}
