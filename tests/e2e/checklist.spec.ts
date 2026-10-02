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

    test("11 · nenhum botão de mentira: imprimir e extrato desabilitados com o motivo; chat, busca e suporte que não existem saem", async ({ page, request, browser }, info) => {
      const mobile = info.project.name === "mobile";
      const token = await staffToken(request, "dono@chapa27.example");
      const call = async (method: string, path: string, data?: unknown) => (await request.fetch(`${API}${path}`, { method, data, headers: { Authorization: `Bearer ${token}` } })).json();
      const P = "/api/restaurants/chapa27";
      const items: { id: string; optionGroups: unknown[]; soldOut: boolean }[] = await call("GET", `${P}/items`);
      const dish = items.find((i) => !i.optionGroups.length && !i.soldOut)!;
      await call("POST", `${P}/tables/26/orders`, { lines: [{ itemId: dish.id, quantity: 1, notes: "", selectedOptions: [] }] });
      await loginAs(page, request, "dono@chapa27.example");
      // Nothing may claim it printed or opened a chat: those don't exist yet.
      const fake = page.getByText(/enviada à impressora|Chat de .* aberto|Abrindo extrato/);
      const soon = (name: string) => expect(page.getByRole("button", { name })).toBeDisabled();
      await page.goto("/");
      if (mobile) await page.getByText("Preparando", { exact: true }).click(); // the phone shows one stage at a time
      await expect(page.getByText("Mesa 26").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Imprimir comanda|Abrir chat/ })).toHaveCount(0);
      if (!mobile) {
        await soon("Impressão em breve");
        await expect(page.getByRole("button", { name: "Impressão em breve" })).toHaveAttribute("title", /em breve/);
        await expect(page.getByPlaceholder("Buscar pedido, mesa, item")).toHaveCount(0); // a search box that searched nothing
      } else {
        await page.goto("/mesas/26");
        await soon("Impressão em breve");
      }
      await expect(fake).toHaveCount(0);
      // The customer's delivery menu (paused): no "Suporte" chat that never opens.
      const guest = await browser.newPage({ viewport: page.viewportSize()! });
      await guest.goto(`${WEB}/r/chapa27/menu`);
      await expect(guest.getByText("Clássico", { exact: true }).first()).toBeVisible();
      await expect(guest.getByRole("button", { name: "Suporte" })).toHaveCount(0);
      await guest.close();
      await call("POST", `${P}/tables/26/close`, { paymentMethod: "Cartão" }); // table 26 free again
    });

    test("13 · erros em português claro: rede, validação, login, permissão (403), conflito (409), limite (429) e servidor", async ({ page, request, browser }) => {
      // The dashboard's login, failing every way the API (or the network) can fail it.
      await page.addInitScript(() => localStorage.removeItem("cardapio.dashboard.session"));
      await page.goto("/");
      await page.getByLabel("E-mail").fill(`ninguem-${Date.now()}@checklist.example`); // 5 misses lock an account: a new one each run
      await page.getByLabel("Senha").fill("senha-errada");
      const shows = async (text: string) => {
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(page.getByText(text)).toBeVisible();
      };
      await shows("E-mail ou senha incorretos."); // the real API's 401 "invalid credentials"
      const answer = async (status: number, error: string) => {
        await page.unroute("**/api/auth/login");
        await page.route("**/api/auth/login", (r) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error }) }));
      };
      await answer(400, "email and password are required");
      await shows("Confira os dados informados e tente de novo.");
      await answer(429, "Too many requests"); // a proxy's own 429
      await shows("Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.");
      await answer(500, "internal error");
      await shows("Algo deu errado no servidor. Tente novamente em instantes.");
      await page.unroute("**/api/auth/login");
      await page.route("**/api/auth/login", (r) => r.abort("internetdisconnected"));
      await shows("Não foi possível conectar ao servidor. Tente novamente.");
      await expect(page.getByText(/invalid|credentials|required|Erro \d|internal|Failed to fetch/)).toHaveCount(0);

      // The cardápio: sending the round fails with a 403, then a 409 (answered here; nothing reaches the kitchen).
      const token = await staffToken(request, "dono@chapa27.example");
      const items: { name: string; optionGroups: unknown[]; soldOut: boolean }[] = await (await request.get(`${API}/api/restaurants/chapa27/items`)).json();
      const dish = items.find((i) => !i.optionGroups.length && !i.soldOut)!;
      const guest = await browser.newPage({ viewport: page.viewportSize()! });
      await guest.goto(await tableUrl(request, token, "chapa27", 25));
      await guest.getByRole("button", { name: `Adicionar ${dish.name} ao pedido` }).first().click();
      await guest.getByRole("button", { name: /Ver carrinho/ }).click();
      await guest.getByRole("button", { name: /Enviar pedido para a cozinha/ }).click();
      for (const [status, error, text] of [
        [403, "forbidden: restaurant mismatch", "Você não tem permissão para fazer isso."],
        [409, "order is not pending", "Isso mudou enquanto você olhava. Atualize a página e confira."]
      ] as const) {
        await guest.unroute("**/api/orders");
        await guest.route("**/api/orders", (r) => (r.request().method() === "POST" ? r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error }) }) : r.continue()));
        await guest.getByRole("button", { name: /Confirmar e enviar para a cozinha/ }).click();
        await expect(guest.locator(".toast")).toContainText(text);
      }
      await guest.close();
    });
  });
}
