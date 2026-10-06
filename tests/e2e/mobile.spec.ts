import { test as plain } from "@playwright/test";
import { R, SEED_MODULES, burgerKit, dayLabel, expect, loginAs, newTable, setModules, test, uid } from "./fixtures";

const toast = (page: import("@playwright/test").Page) => page.locator(".toast-bubble");

test("Mais agrupa as telas nas mesmas seções do desktop", async ({ page }) => {
  await page.goto("/mais");
  for (const section of ["Operação", "Financeiro"]) await expect(page.getByText(section, { exact: true })).toBeVisible();
  for (const screen of ["Visão Geral", "Contas a Pagar", "Contas a Receber", "Minha Fatura", "Produtos"]) {
    await expect(page.getByRole("button", { name: new RegExp(screen) })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Emissão Fiscal/ })).toHaveCount(0); // module off for the demo restaurant
  await page.getByRole("button", { name: /Contas a Pagar/ }).click();
  await expect(page).toHaveURL(/contas-a-pagar/);
});

test("módulo desligado some da barra de abas", async ({ page, request }) => {
  await setModules(request, SEED_MODULES.filter((m) => m !== "mesas"));
  try {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Cardápio$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mesas$/ })).toHaveCount(0);
  } finally {
    await setModules(request, SEED_MODULES);
  }
});

test("fechar a conta no celular pede a forma de pagamento, baixa a ficha técnica e lança em Contas a Receber", async ({ page, api }) => {
  const { pao, blend, item } = await burgerKit(api);
  const { number: table, code } = await newTable(api);
  const order = await api("POST", "/api/orders", { mode: "table", restaurantId: R, tableCode: code, lines: [{ itemId: item.id, quantity: 3, notes: "", selectedOptions: [] }] });
  await api("POST", `/api/orders/${order.id}/accept`); // the table was free: accepting opens it

  await page.goto(`/mesas/${table}`);
  await page.getByRole("button", { name: /Fechar conta/ }).click();
  await page.getByRole("button", { name: "PIX" }).click();
  await expect(toast(page)).toContainText(`Mesa ${table}`);
  const entry = (await api("GET", `/api/restaurants/${R}/finance-entries?kind=receivable`)).find((e: { description: string }) => e.description === `Mesa ${table} · comanda ${order.code}`); // codes are 4 random digits: the table disambiguates
  expect([entry.amount, entry.status, entry.paymentMethod]).toEqual([99, "paid", "PIX"]); // 3 × 30,00 + 10%

  await page.goto("/produtos");
  await expect(page.getByRole("button", { name: new RegExp(pao.name) })).toContainText("-3 un");
  await expect(page.getByRole("button", { name: new RegExp(blend.name) })).toContainText("-0,45 kg");
  await page.getByRole("button", { name: "Movimentações" }).click();
  await expect(page.getByText(`Fechamento de comanda ${order.code}`)).toHaveCount(2);
});

test("no celular a cozinha não vê Fechar conta na mesa com comanda aberta; o garçom vê (F-4)", async ({ page, api, request }) => {
  const { item } = await burgerKit(api);
  const { number: table } = await newTable(api);
  await api("POST", `/api/restaurants/${R}/tables/${table}/orders`, { lines: [{ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] }] });
  for (const [email, close] of [["igor@fogoeno.com.br", 0], ["paula@fogoeno.com.br", 1]] as const) {
    await loginAs(page, request, email); // the last init script wins
    await page.goto(`/mesas/${table}`);
    await expect(page.getByRole("button", { name: "Lançar pedido" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fechar conta/ }), email).toHaveCount(close);
  }
  await api("POST", `/api/restaurants/${R}/tables/${table}/close`, {});
});

// J-3 (UX-07 · 4a): on the phone the Catálogo is grouped in cards by category; each category's "…" renames, deletes or
// opens Ordenar categorias (the Cardápio's arrows, same order); search and type narrow it.
test("J-3 · Produtos no celular: cartões por categoria, busca, tipo e o … da categoria com Renomear, Excluir e Ordenar", async ({ page, api }) => {
  const { pao } = await burgerKit(api); // an insumo without a category
  await page.goto("/produtos");
  await expect(page.getByRole("button", { name: /^Lanches \d+$/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /^Sem categoria \d+$/ })).toBeVisible();
  await page.getByLabel("Buscar por nome").fill(pao.name);
  await expect(page.getByRole("button", { name: new RegExp(pao.name) })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Lanches \d+$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(pao.name) })).toHaveCount(0);
  await page.getByRole("button", { name: "Todos", exact: true }).click();

  await page.getByRole("button", { name: "Opções da categoria Lanches" }).click();
  for (const action of ["Renomear", "Excluir", "Ordenar categorias"]) await expect(page.getByRole("button", { name: action, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  const box = page.getByRole("dialog", { name: "Excluir “Lanches”?" });
  await expect(box).toContainText(/Esta categoria tem \d+ itens/);
  await box.getByRole("button", { name: "Entendi" }).click();
  await page.getByRole("button", { name: "Opções da categoria Lanches" }).click();
  await page.getByRole("button", { name: "Ordenar categorias" }).click();
  await expect(page.getByRole("button", { name: "Subir Lanches" })).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("button", { name: /^Lanches \d+$/ })).toBeVisible();
});

// J-4 (UX-07 · 4b): on the phone the cadastro takes the whole screen, Cancelar and Salvar in the top bar, no X.
test("J-4 · cadastro no celular em tela cheia, com Cancelar e Criar item na barra de cima", async ({ page }) => {
  await page.goto("/produtos");
  await page.getByRole("button", { name: "Novo item" }).click();
  const sheet = page.getByRole("dialog", { name: "Novo item" });
  await expect(sheet).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))); // dcScaleIn: measure after it
  const box = (await sheet.boundingBox())!;
  expect([box.x, box.y, box.width, box.height].map(Math.round)).toEqual([0, 0, 390, 844]);
  for (const name of ["Cancelar", "Criar item"]) expect((await sheet.getByRole("button", { name, exact: true }).boundingBox())!.y).toBeLessThan(60);
  await expect(sheet.getByRole("button", { name: "Fechar" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Cancelar" }).click();
  await expect(sheet).toBeHidden();
});

test("cadastro de produto no celular: a busca da composição ocupa a linha inteira", async ({ page }) => {
  await page.goto("/produtos");
  await page.getByRole("button", { name: "Novo item" }).click();
  await page.getByRole("switch").click();
  const search = await page.getByLabel("Produto ou insumo").first().boundingBox();
  expect(search!.width).toBeGreaterThan(250);
});

test("Cardápio no celular: adicionar prato vincula do Catálogo e remover tira do cardápio", async ({ page, api }) => {
  const prato = await api("POST", `/api/restaurants/${R}/products`, { name: `Pudim ${uid()}`, type: "produto", unit: "un", price: 18, cost: 0, ncm: "", cst: "", taxRate: 0, composed: false, components: [] });
  await page.goto("/cardapio");
  await page.getByRole("button", { name: "Adicionar prato" }).click();
  const dialog = page.getByRole("dialog", { name: "Adicionar prato ao cardápio" });
  await dialog.getByLabel("Buscar prato no Catálogo").fill(prato.name);
  await dialog.locator("div", { hasText: prato.name }).getByRole("button", { name: "Adicionar" }).last().click();
  await dialog.getByRole("button", { name: "Concluir" }).click();

  const row = page.locator("main div", { hasText: prato.name }).filter({ has: page.locator("button:has(.fa-ellipsis)") }).last();
  await row.locator("button:has(.fa-ellipsis)").click();
  await expect(page.getByRole("button", { name: "Duplicar produto" })).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remover do cardápio" }).click();
  await expect(toast(page)).toContainText("removido do cardápio");
  await expect(page.getByText(prato.name)).toHaveCount(0);
});

test("Contas no celular: quitar pela folha", async ({ page, api }) => {
  const desc = `Energia ${uid()}`;
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  await api("POST", `/api/restaurants/${R}/finance-entries`, { kind: "payable", description: desc, amount: 1340.5, dueDate: new Date().toLocaleDateString("sv-SE"), status: "pending" });

  await page.goto("/contas-a-pagar");
  await page.locator("main div", { hasText: desc }).filter({ has: page.getByRole("button", { name: "Quitar" }) }).last().getByRole("button", { name: "Quitar" }).click();
  const pay = page.getByRole("dialog", { name: "Quitar conta" });
  await pay.getByRole("button", { name: dayLabel(firstOfMonth) }).click();
  await pay.getByRole("button", { name: "Confirmar quitação" }).click();
  await expect(page.locator("main div", { hasText: desc }).filter({ hasText: "Pago" }).last()).toBeVisible();
});

test("Atendimento no celular: status e canal ficam no botão Filtros", async ({ page }) => {
  await page.goto("/atendimento");
  await expect(page.getByRole("button", { name: "Todos", exact: true })).toHaveCount(0); // old chip row is gone
  const count = page.getByText(/^\d+ conversas?$/);
  const before = await count.textContent();
  await page.getByRole("button", { name: /Filtros/ }).click();
  const panel = page.getByRole("dialog", { name: "Filtros" });
  await panel.getByRole("tab", { name: /Canal/ }).click();
  await panel.getByRole("button", { name: "Mesa", exact: true }).click();
  await panel.getByRole("button", { name: /^Mostrar/ }).click();
  await expect(count).not.toHaveText(before!);
});

test.describe("tema escuro", () => {
  test.use({ theme: "dark" });

  test("a folha de filtros cobre a tela inteira e o texto é legível", async ({ page }) => {
    await page.goto("/contas-a-pagar");
    await page.getByRole("button", { name: /Filtros/ }).click();
    const panel = page.getByRole("dialog", { name: "Filtros" });
    await expect(panel).toBeVisible();

    // Above the + button (it used to sit on top of the sheet) …
    const fab = await page.locator('button[title="Novo lançamento"]').boundingBox();
    const onTop = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("[role=dialog]"), [fab!.x + fab!.width / 2, fab!.y + fab!.height / 2]);
    expect(onTop).toBe(true);

    // … and light text on the dark sheet (it used to inherit the light theme's dark ink).
    const [r] = await panel.getByText("Filtros", { exact: true }).evaluate((el) => getComputedStyle(el).color.match(/\d+/g)!.map(Number));
    expect(r).toBeGreaterThan(150);
  });
});

test("Sair da conta volta para a tela de login", async ({ page }) => {
  await page.goto("/mais");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page.locator("input[type=email]")).toBeVisible();
});

plain("garçom lança o pedido da mesa pelo celular: escolhe, revisa, envia; a Central mostra com o nome dele", async ({ page, request }) => {
  const { token } = await (await request.post("http://localhost:4200/api/auth/login", { data: { email: "garcom@chapa27.example", password: "senha123" } })).json();
  await request.post("http://localhost:4200/api/restaurants/chapa27/tables/8/close", { headers: { Authorization: `Bearer ${token}` } });
  await loginAs(page, request, "garcom@chapa27.example");
  await page.goto("/mesas/8");
  await page.getByRole("button", { name: /Lançar pedido/ }).first().click();
  await expect(page).toHaveURL(/\/mesas\/8\/pedido$/);
  await page.getByRole("button", { name: "Adicionar Refrigerante lata 350 ml" }).click();
  await page.getByRole("button", { name: "Adicionar Refrigerante lata 350 ml" }).click();
  await page.getByRole("button", { name: "Adicionar Cheddar & Bacon" }).click();
  const sheet = page.getByRole("dialog", { name: "Cheddar & Bacon" });
  await sheet.getByText("Bem passado", { exact: true }).click();
  await sheet.getByText("Bacon extra", { exact: true }).click();
  await sheet.getByPlaceholder("Ex.: sem cebola").fill("sem cebola");
  await sheet.getByRole("button", { name: /Adicionar · R\$ 44,90/ }).click();
  await expect(page.getByRole("button", { name: "Revisar e enviar" })).toBeInViewport(); // the total bar stays on screen
  await page.getByRole("button", { name: "Revisar e enviar" }).click();
  const review = page.getByRole("dialog", { name: "Revisar pedido" });
  await expect(review).toContainText("R$ 58,90");
  await review.getByRole("button", { name: "Enviar para a cozinha" }).dblclick(); // one order, not two
  await expect(toast(page)).toContainText("Pedido da Mesa 08 enviado para a cozinha");
  await expect(page).toHaveURL(/\/mesas\/8$/);

  const orders = await (await request.get("http://localhost:4200/api/restaurants/chapa27/orders", { headers: { Authorization: `Bearer ${token}` } })).json();
  const mine = orders.filter((o: { tableNumber: number; waiterName: string | null; status: string }) => o.tableNumber === 8 && o.waiterName && o.status === "preparing"); // straight into production
  expect(mine.length).toBe(1);
  const tables = await (await request.get("http://localhost:4200/api/restaurants/chapa27/tables", { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(tables.find((t: { number: number }) => t.number === 8).status).toBe("occupied"); // the waiter's order opens the table, no acceptance
  expect([mine[0].waiterName, mine[0].total, mine[0].lines[1].notes]).toEqual(["Diego Alves", 58.9, "sem cebola"]);
  await page.goto("/");
  await page.getByRole("button", { name: /Preparando/ }).first().click();
  const card = page.locator("article").filter({ hasText: "Mesa 08" }).filter({ hasText: "sem cebola" });
  await expect(card).toContainText("Lançado no estabelecimento");
  await expect(card).toContainText("Diego Alves");
});

test("a barra de abas fica sempre na tela, mesmo com a lista rolada até o fim", async ({ page }) => {
  for (const path of ["/", "/cardapio", "/mesas"]) {
    await page.goto(path);
    await page.locator("main").evaluate((m) => (m.scrollTop = m.scrollHeight));
    await expect(page.getByRole("button", { name: "Mais" }).last()).toBeInViewport();
  }
});

test.describe("tema escuro", () => {
  test.use({ theme: "dark" });
  test("o selo de pedidos novos da Central é legível no tema escuro (contraste de pelo menos 4,5:1)", async ({ page, api }) => {
    const item = (await api<{ id: string; soldOut: boolean }[]>("GET", `/api/restaurants/${R}/items`)).find((i) => !i.soldOut)!;
    const order = await api("POST", "/api/orders", { mode: "delivery", restaurantId: R, lines: [{ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] }] }); // a pending one: the badge shows
    await page.goto("/mesas");
    const badge = page.locator("nav button").first().locator(".mono");
    await expect(badge).toBeVisible({ timeout: 15_000 });
    const ratio = await badge.evaluate((el) => {
      const lum = (rgb: string) => {
        const [r, g, b] = (rgb.match(/\d+/g) ?? []).slice(0, 3).map((v) => Number(v) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const s = getComputedStyle(el);
      const [hi, lo] = [lum(s.color), lum(s.backgroundColor)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    await api("POST", `/api/orders/${order.id}/reject`);
  });
});

// K-1: on the phone the Cardápio's dish row cut the name at "Ched…", broke the price into "R$" / "32,90" and ran the
// schedule under the Disponível switch. Measured by the elements' boxes, at 360 and 390 px, in both themes.
for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme });
    test(`K-1 · linha do prato no Cardápio do celular: nome em até 2 linhas, preço numa linha, horário sem sobrepor, alvos de 44 px (${theme})`, async ({ page, api }) => {
      const tag = uid().slice(-4);
      const schedule = "Almoço 11:30 – 15:00 · Jantar 18:00 – 23:30"; // the demo seed's label
      const dishes = [`Batata com Cheddar e Bacon ${tag}`, `Hambúrguer Duplo com Cheddar Cremoso, Bacon Crocante e Cebola Caramelizada ${tag}`];
      for (const name of dishes) await api("POST", `/api/restaurants/${R}/items`, { categoryId: `${R}-cat-1`, name, price: 32.9, shortDescription: "", scheduleLabel: schedule });

      await page.goto("/cardapio");
      for (const width of [360, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const [i, name] of dishes.entries()) {
          const at = `${width} px, ${name}`;
          const toggle = page.getByRole("switch", { name: `${name} disponível` });
          const options = page.getByRole("button", { name: `Opções de ${name}` });
          const row = toggle.locator("xpath=..");
          await row.scrollIntoViewIfNeeded();
          const title = row.getByText(name, { exact: true });
          const price = row.getByText("R$ 32,90", { exact: true });
          const when = row.getByText(schedule, { exact: true });

          const fit = await title.evaluate((el) => ({ lines: Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)), cutSideways: el.scrollWidth > el.clientWidth, cutBelow: el.scrollHeight > el.clientHeight + 1 }));
          expect.soft(fit.cutSideways, `${at}: nome cortado na largura`).toBe(false);
          expect.soft(fit.lines, `${at}: nome em até 2 linhas`).toBeLessThanOrEqual(2);
          if (i === 0) expect.soft(fit.cutBelow, `${at}: nome que cabe em 2 linhas aparece inteiro`).toBe(false);
          const priceLines = await price.evaluate((el) => {
            const r = document.createRange();
            r.selectNodeContents(el);
            return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
          });
          expect.soft(priceLines, `${at}: preço numa linha só`).toBe(1);

          const boxes = { nome: await title.boundingBox(), preço: await price.boundingBox(), horário: await when.boundingBox() };
          for (const [control, target] of [["Disponível", await toggle.boundingBox()], ["Opções", await options.boundingBox()]] as const) {
            expect.soft(target!.width >= 44 && target!.height >= 44, `${at}: alvo ${control} ${target!.width}×${target!.height}`).toBe(true);
            for (const [part, b] of Object.entries(boxes)) {
              const overlaps = b!.x < target!.x + target!.width && target!.x < b!.x + b!.width && b!.y < target!.y + target!.height && target!.y < b!.y + b!.height;
              expect.soft(overlaps, `${at}: ${part} sobrepõe ${control}`).toBe(false);
            }
          }
          const last = (await options.boundingBox())!;
          expect.soft(last.x + last.width, `${at}: a linha cabe na tela`).toBeLessThanOrEqual(width);
        }
      }
    });
  });
}
