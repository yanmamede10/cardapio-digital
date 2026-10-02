import type { Page } from "@playwright/test";
import { adminApi, asSuperAdmin, expect, loginAs, loginFreshOwner, newRestaurant, staffToken, tableUrl, test } from "./fixtures";

// The UI checklist (items 1–20), on desktop and phone, light and dark — the UX-03 way. Each test names its item.
const WEB = "http://localhost:5273";
const API = "http://localhost:4200";

/** Nothing reaches past the screen's right edge, unless a scrolling or clipping box holds it in. */
async function fits(p: Page, where: string) {
  const out = await p.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const held = (e: Element) => {
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== "visible" && a.getBoundingClientRect().right <= w + 1) return true;
      }
      return false;
    };
    const wide = [...document.querySelectorAll("body *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > w + 1 && !held(e);
    });
    return { page: document.documentElement.scrollWidth - w, wide: wide.slice(0, 3).map((e) => `${e.tagName} "${(e.textContent ?? "").trim().slice(0, 50)}"`) };
  });
  expect(out.page, `${where}: rolagem lateral`).toBeLessThanOrEqual(1);
  expect(out.wide, `${where}: passa da borda`).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme });

    test("1 · sem rolagem lateral: no celular a 360 e 390 px, no desktop a 1366 px — as telas do Dono, o Super Admin e o cardápio", async ({ page, request }, info) => {
      test.setTimeout(240_000);
      const mobile = info.project.name === "mobile";
      const shared = ["/", "/mesas", "/mesas/qr", "/cardapio", "/atendimento", "/promocoes", "/relatorios", "/financeiro", "/produtos", "/visao-geral", "/contas-a-pagar", "/contas-a-receber", "/config"];
      const routes = mobile ? [...shared, "/mais", "/mesas/1", "/config/perfil", "/config/horarios", "/config/equipe", "/config/fiscal", "/config/whatsapp", "/config/salao"] : shared;
      const token = await staffToken(request, "dono@chapa27.example");
      const menu = await tableUrl(request, token, "chapa27", 21);
      const items: { id: string }[] = await (await request.get(`${API}/api/restaurants/chapa27/items`)).json();
      await loginAs(page, request, "dono@chapa27.example");
      await asSuperAdmin(page);
      const settle = () => expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 8_000 });
      for (const width of mobile ? [360, 390] : [1366]) {
        await page.setViewportSize({ width, height: mobile ? 780 : 820 });
        for (const path of [...routes, "/admin", "/admin/mensalidades"]) {
          await page.goto(path);
          await settle();
          await fits(page, `${path} a ${width} px`);
        }
        for (const url of [menu, `${WEB}/r/chapa27/item/${items[0].id}`, `${WEB}/cart`, `${WEB}/t/codigo-que-nao-existe`]) {
          await page.goto(url);
          await settle();
          await fits(page, `${url.replace(WEB, "cardápio ")} a ${width} px`);
        }
      }
    });

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
      await guest.goto(`${WEB}/r/${r.id}/item/${dish.id}`);
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

    test("17 · o logo leva ao início: no painel, à tela inicial do papel; no cardápio, ao topo do cardápio", async ({ page, request, browser }) => {
      await loginAs(page, request, "dono@chapa27.example");
      await page.goto("/mesas");
      await page.getByRole("link", { name: "MesaPronta: início" }).click();
      await expect(page).toHaveURL(/:5274\/$/);
      await expect(page).toHaveTitle(/^Central de Pedidos · /);
      // The cardápio at a table: scrolled down, the restaurant's logo brings the menu back to its top.
      const token = await staffToken(request, "dono@chapa27.example");
      const guest = await browser.newPage({ viewport: page.viewportSize()! });
      await guest.goto(await tableUrl(request, token, "chapa27", 24));
      const scroller = guest.locator(".scroll").first();
      await expect(guest.getByText("Clássico", { exact: true }).first()).toBeVisible();
      await scroller.evaluate((el) => el.scrollTo(0, 900));
      await guest.getByRole("button", { name: /voltar ao topo do cardápio/ }).click();
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
      await guest.close();
    });

    test("16 · textos longos não estouram a tela: nome de prato, observação do pedido e nome do cliente no WhatsApp", async ({ page, request, browser }, info) => {
      test.setTimeout(90_000);
      const mobile = info.project.name === "mobile";
      // A restaurant of its own: it accepts the WhatsApp terms (the webhook ignores a restaurant that hasn't), which no
      // other test may see.
      const r = await newRestaurant(request);
      await adminApi(request, "PATCH", `/restaurants/${r.id}/status`, { status: "ativo" });
      await loginFreshOwner(page, request, r);
      const { token } = await (await request.post(`${API}/api/auth/login`, { data: { email: r.ownerEmail, password: "senha-nova-1" } })).json();
      const call = async (method: string, path: string, data?: unknown) => (await request.fetch(`${API}${path}`, { method, data, headers: { Authorization: `Bearer ${token}` } })).json();
      const P = `/api/restaurants/${r.id}`;
      // At the limits: an 80-character dish name, a 300-character note with a 40-letter run-on word, a long WhatsApp name.
      const dishName = "Hambúrguer Artesanal Supremo Triplo com Cheddar Defumado, Bacon e Cebola Caramelo".slice(0, 80);
      const note = `Sem cebola e sem tomate, ${"semmaionesesemcatchupsemmostardaporfavor"} pão bem tostado, carne ao ponto para bem passada, queijo derretido por cima e embalar o molho separado, que é para viagem; obrigado!`.padEnd(300, " ok").slice(0, 300);
      const customer = "Maria Aparecida dos Santos Albuquerque de Oliveira Figueiredo Junior";
      const [category]: { id: string }[] = await call("POST", `${P}/categories`, { name: "Lanches" }); // answers with the list
      const dish: { id: string } = await call("POST", `${P}/items`, { categoryId: category.id, name: dishName, price: 39.9, shortDescription: "" });
      const { number } = await call("POST", `${P}/tables`, { seats: 4 });
      await call("PATCH", `${P}/tables/${number}/position`, { gridRow: 0, gridCol: 0 }); // on the map (a new table waits off it)
      await call("POST", `${P}/tables/${number}/orders`, { lines: [{ itemId: dish.id, quantity: 1, notes: note, selectedOptions: [] }] });
      await call("POST", `${P}/whatsapp/terms`);
      await request.post(`${API}/api/whatsapp/webhook`, {
        headers: { "x-webhook-secret": "test-webhook-secret" },
        data: { event: "messages.upsert", instance: r.id, data: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: `LONG-${Date.now()}` }, pushName: customer, messageType: "conversation", messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: "Oi, vocês abrem hoje?" } } }
      });
      const ticket = (await call("GET", `${P}/tickets`) as { id: string; customerName: string }[]).find((t) => t.customerName === customer)!;
      expect(ticket, "a conversa chegou").toBeTruthy();

      const seen = async (p: import("@playwright/test").Page, text: string) => expect(p.getByText(text.slice(0, 24)).first()).toBeVisible();

      await page.goto("/");
      if (mobile) await page.getByText("Preparando", { exact: true }).click();
      await seen(page, dishName);
      await fits(page, "Central de Pedidos");
      if (mobile) {
        await page.goto(`/mesas/${number}`);
      } else {
        await page.goto("/mesas");
        await page.locator(`button[title^="Mesa ${String(number).padStart(2, "0")} ·"]`).first().click();
      }
      await seen(page, dishName);
      await fits(page, "comanda da mesa");
      await page.goto("/cardapio");
      await seen(page, dishName);
      await fits(page, "Cardápio do painel");
      await page.goto(mobile ? `/atendimento/${ticket.id}` : "/atendimento");
      if (!mobile) await page.getByText(customer.slice(0, 24)).first().click();
      await seen(page, customer);
      await fits(page, "Atendimento");

      // The customer's side: the menu card and the dish's page.
      const guest = await browser.newPage({ viewport: page.viewportSize()! });
      await guest.goto(await tableUrl(request, token, r.id, number));
      await seen(guest, dishName);
      await fits(guest, "cardápio do cliente");
      await guest.goto(`${WEB}/r/${r.id}/item/${dish.id}`);
      await seen(guest, dishName);
      await fits(guest, "página do prato");
      await guest.close();

    });

    test("19 · e-mail na tela é link mailto: a equipe (desktop) e as pessoas de um restaurante no Super Admin", async ({ page, request }, info) => {
      const mail = (address: string) => page.locator(`a[href="mailto:${address}"]`).first();
      if (info.project.name !== "mobile") {
        await loginAs(page, request, "dono@chapa27.example");
        await page.goto("/config");
        await page.getByRole("radio", { name: "Equipe & Permissões" }).or(page.getByRole("button", { name: "Equipe & Permissões" })).first().click();
        await expect(mail("dono@chapa27.example")).toBeVisible();
      }
      // On the phone the team's e-mail sits inside the button that opens the person: a link can't go in a button.
      await asSuperAdmin(page);
      await page.goto("/admin/restaurantes/chapa27");
      await expect(mail("dono@chapa27.example")).toBeVisible();
      await expect(mail("dono@chapa27.example")).toHaveText("dono@chapa27.example");
    });

    test("10 · a foto do prato sai do painel reduzida e comprimida: uma de 3000 px e alguns MB chega com até 1200 px e poucas centenas de KB", async ({ page, request }, info) => {
      const mobile = info.project.name === "mobile";
      const items: { id: string; name: string }[] = await (await request.get(`${API}/api/restaurants/chapa27/items`)).json();
      const dish = items[0];
      await loginAs(page, request, "dono@chapa27.example");
      await page.goto(mobile ? `/cardapio/${dish.id}/editar` : "/cardapio");
      // A phone photo, made by the browser: 3000 × 2250, JPEG at 95%, with grain (grain is what makes photos heavy).
      const original = Buffer.from(await page.evaluate(async () => {
        const c = Object.assign(document.createElement("canvas"), { width: 3000, height: 2250 });
        const g = c.getContext("2d")!;
        const grad = g.createLinearGradient(0, 0, 3000, 2250);
        grad.addColorStop(0, "#8a4b2a");
        grad.addColorStop(1, "#f2d39b");
        g.fillStyle = grad;
        g.fillRect(0, 0, 3000, 2250);
        const px = g.getImageData(0, 0, 3000, 2250);
        for (let i = 0; i < px.data.length; i += 4) {
          const n = (Math.random() - 0.5) * 36;
          px.data[i] += n;
          px.data[i + 1] += n;
          px.data[i + 2] += n;
        }
        g.putImageData(px, 0, 0);
        const blob = await new Promise<Blob>((done) => c.toBlob((b) => done(b!), "image/jpeg", 0.95));
        const url = await new Promise<string>((done) => Object.assign(new FileReader(), { onload: (e: ProgressEvent<FileReader>) => done(String(e.target!.result)) }).readAsDataURL(blob));
        return url.slice(url.indexOf(",") + 1);
      }), "base64");
      expect(original.length).toBeGreaterThan(2_000_000);
      // What the dashboard sends (the test API has no public bucket: the upload is answered here).
      let sent: Buffer | null = null;
      await page.route("**/items/*/image", async (route) => {
        sent = route.request().postDataBuffer();
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "file storage is not configured" }) });
      });
      if (!mobile) await page.getByRole("button", { name: `Organizar ${dish.name}` }).first().click();
      await page.locator('input[type=file][accept^="image/"]').first().setInputFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: original });
      await expect.poll(() => sent?.length ?? 0, { timeout: 15_000 }).toBeGreaterThan(0);
      const body = sent!;
      const boundary = body.subarray(0, body.indexOf("\r\n")).toString();
      const part = body.indexOf('name="file"');
      const start = body.indexOf("\r\n\r\n", part) + 4;
      const file = body.subarray(start, body.indexOf(`\r\n${boundary}`, start));
      expect(body.subarray(part, start).toString()).toContain("Content-Type: image/jpeg");
      expect(file.length).toBeLessThan(600_000);
      const [width, height] = await page.evaluate(async (b64) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
        return [bmp.width, bmp.height];
      }, file.toString("base64"));
      expect(Math.max(width, height)).toBe(1200);
      expect(width / height).toBeCloseTo(3000 / 2250, 2);
    });
  });
}
