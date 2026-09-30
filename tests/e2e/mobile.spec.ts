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
