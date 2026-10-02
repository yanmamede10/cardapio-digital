import { asSuperAdmin, expect, loginAs, staffToken, tableUrl, test } from "./fixtures";

// The UI checklist (items 1–20), on desktop and phone, light and dark — the UX-03 way. Each test names its item.
const WEB = "http://localhost:5273";
const API = "http://localhost:4200";

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

    test("6 · o cardápio tem meta description (o que aparece na busca e na prévia do link)", async ({ page }) => {
      await page.goto(WEB);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length ?? 0).toBeGreaterThan(50);
      expect(description!.length).toBeLessThanOrEqual(160);
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

    test("14 · Chapa 27 (maquininha própria): fechar a conta não mostra QR de PIX; o cardápio sem rótulo de rascunho nem estrelas fixas", async ({ page, request, browser }, info) => {
      const mobile = info.project.name === "mobile";
      const token = await staffToken(request, "dono@chapa27.example");
      const call = async (method: string, path: string, data?: unknown) => (await request.fetch(`${API}${path}`, { method, data, headers: { Authorization: `Bearer ${token}` } })).json();
      const P = "/api/restaurants/chapa27";
      expect((await call("GET", `${P}/payment-mode`)).paymentMode).toBe("maquininha_propria");
      const items: { id: string; optionGroups: unknown[]; soldOut: boolean }[] = await call("GET", `${P}/items`);
      const dish = items.find((i) => !i.optionGroups.length && !i.soldOut)!;
      await call("POST", `${P}/tables/27/orders`, { lines: [{ itemId: dish.id, quantity: 1, notes: "", selectedOptions: [] }] });
      const pixQr = page.locator('img[alt="QR code PIX"]');
      await loginAs(page, request, "dono@chapa27.example");
      if (mobile) {
        await page.goto("/mesas/27");
        await page.getByRole("button", { name: /^Fechar conta ·/ }).click();
        await page.getByRole("button", { name: "PIX", exact: true }).click(); // the maquininha's PIX: the bill closes
      } else {
        await page.goto("/mesas");
        await page.locator('button[title^="Mesa 27 ·"]').first().click();
        await page.getByRole("button", { name: "Fechar conta" }).click();
        await expect(page.getByText("Forma de pagamento na maquininha")).toBeVisible();
        await expect(pixQr).toHaveCount(0);
        await page.getByRole("button", { name: "PIX", exact: true }).click();
        await page.getByRole("button", { name: "Confirmar pagamento" }).click();
      }
      await expect(page.getByText("Conta da Mesa 27 fechada")).toBeVisible();
      await expect(pixQr).toHaveCount(0);
      await expect(page.getByText(/copia e cola/i)).toHaveCount(0);

      // The customer's menu at a table: no "foto · …" wireframe captions where a dish (or the cover) has no photo, and the
      // stars show the restaurant's own rating (Chapa 27 has no reviews yet: none filled), not a fixed four.
      const { rating } = await (await request.get(`${API}${P}`)).json();
      const guest = await browser.newPage({ viewport: page.viewportSize()! });
      await guest.goto(await tableUrl(request, token, "chapa27", 27));
      await expect(guest.getByText("Clássico", { exact: true }).first()).toBeVisible();
      await expect(guest.getByText(/foto ·/)).toHaveCount(0);
      const stars = guest.getByRole("img", { name: /^Nota / }).locator(".fa-star");
      await expect(stars).toHaveCount(5);
      const filled = await stars.evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.opacity === "1").length);
      expect(filled).toBe(Math.round(rating));
      await guest.goto(`${WEB}/r/chapa27/item/${dish.id}`);
      await expect(guest.getByRole("button", { name: /Adicionar ao carrinho/ })).toBeVisible();
      await expect(guest.getByText(/foto ·/)).toHaveCount(0);
      await guest.close();
    });
  });
}
