import { R, burgerKit, dayLabel, expect, test, uid } from "./fixtures";

const toast = (page: import("@playwright/test").Page) => page.locator(".toast-bubble");

test("Mais agrupa as telas nas mesmas seções do desktop", async ({ page }) => {
  await page.goto("/mais");
  for (const section of ["Operação", "Financeiro"]) await expect(page.getByText(section, { exact: true })).toBeVisible();
  for (const screen of ["Visão Geral", "Contas a Pagar", "Contas a Receber", "Emissão Fiscal", "Minha Fatura", "Produtos"]) {
    await expect(page.getByRole("button", { name: new RegExp(screen) })).toBeVisible();
  }
  await page.getByRole("button", { name: /Contas a Pagar/ }).click();
  await expect(page).toHaveURL(/contas-a-pagar/);
});

test("fechar a conta no celular baixa os insumos da ficha técnica", async ({ page, api }) => {
  const { pao, blend, item } = await burgerKit(api);
  const table = 100 + Math.floor(Math.random() * 800);
  const order = await api("POST", "/api/orders", { mode: "table", restaurantId: R, tableNumber: table, lines: [{ itemId: item.id, quantity: 3, notes: "", selectedOptions: [] }] });

  await page.goto(`/mesas/${table}`);
  await page.getByRole("button", { name: /Fechar conta/ }).click();
  await expect(toast(page)).toContainText(`Mesa ${table}`);

  await page.goto("/produtos");
  await expect(page.getByRole("button", { name: new RegExp(pao.name) })).toContainText("-3 un");
  await expect(page.getByRole("button", { name: new RegExp(blend.name) })).toContainText("-0,45 kg");
  await page.getByRole("button", { name: "Movimentações" }).click();
  await expect(page.getByText(`Fechamento de comanda ${order.code}`)).toHaveCount(2);
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
