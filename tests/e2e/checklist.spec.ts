import { asSuperAdmin, expect, loginAs, staffToken, tableUrl, test } from "./fixtures";

// The UI checklist (items 1–20), on desktop and phone, light and dark — the UX-03 way. Each test names its item.
const WEB = "http://localhost:5273";

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme });

    test("4 · favicon no painel e no cardápio: o MP da MesaPronta", async ({ page }) => {
      for (const url of ["/", WEB]) {
        await page.goto(url);
        const href = await page.locator('link[rel~="icon"]').getAttribute("href");
        expect(href, url).toBeTruthy();
        const svg = decodeURIComponent(href!.replace(/^data:image\/svg\+xml,/, ""));
        expect(svg, url).toContain(">MP</text>");
        expect(svg, url).toContain("#732009");
      }
    });

    test("5 · título da aba específico em cada tela: \"<tela> · <restaurante>\" no painel e no cardápio", async ({ page, request, browser }, info) => {
      const mobile = info.project.name === "mobile";
      await loginAs(page, request, "dono@chapa27.example");
      const R = "Chapa 27 Burgers";
      const screens: [string, string][] = [
        ["/", "Central de Pedidos"],
        ["/mesas", mobile ? "Mesas e Comandas" : "Mesas"],
        ["/cardapio", "Cardápio"],
        ["/atendimento", "Atendimento"],
        ["/produtos", "Produtos"],
        ["/relatorios", "Relatórios"],
        ["/config", "Configurações"]
      ];
      for (const [path, screen] of screens) {
        await page.goto(path);
        await expect(page, path).toHaveTitle(`${screen} · ${R}`);
      }
      // The cardápio, opened by a table's QR: the menu, a dish, the round (its cart); a code that doesn't exist says so in the tab too.
      const staff = await staffToken(request, "dono@chapa27.example");
      const guest = await page.context().newPage();
      await guest.goto(await tableUrl(request, staff, "chapa27", 3));
      await expect(guest).toHaveTitle(`Cardápio · ${R}`);
      await guest.getByText("Clássico", { exact: true }).first().click();
      await expect(guest).toHaveTitle(`Clássico · ${R}`);
      await guest.goto(`${WEB}/cart`);
      await expect(guest).toHaveTitle(`Sua rodada · ${R}`);
      await guest.goto(`${WEB}/t/codigo-que-nao-existe`);
      await expect(guest).toHaveTitle("Mesa não encontrada · Cardápio Digital");
      await guest.close();
      // Before any login, and the Super Admin.
      const anon = await browser.newPage();
      await anon.goto("http://localhost:5274/");
      await expect(anon).toHaveTitle("Entrar · MesaPronta Gestão");
      await asSuperAdmin(anon);
      await anon.goto("http://localhost:5274/admin");
      await expect(anon).toHaveTitle("Restaurantes · Super Admin");
      await anon.goto("http://localhost:5274/admin/mensalidades");
      await expect(anon).toHaveTitle("Mensalidades · Super Admin");
      await anon.close();
    });
  });
}
