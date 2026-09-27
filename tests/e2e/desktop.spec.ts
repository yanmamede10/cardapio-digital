import { test as plain } from "@playwright/test";
import { R, SEED_MODULES, burgerKit, dayLabel, expect, isoDay, loginAs, setModules, test, uid } from "./fixtures";

const toast = (page: import("@playwright/test").Page) => page.locator(".toast-bubble");

plain("login pela tela leva ao painel", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=email]").fill("marina@fogoeno.com.br");
  await page.locator("input[type=password]").fill("senha123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByRole("button", { name: "Operação" })).toBeVisible();
});

plain("menu mostra só o que o papel alcança: Funcionário só Operação (garçom com Atendimento), Administrador sem Configurações", async ({ page, request }) => {
  const nav = page.locator("aside nav");
  const hidden = ["Promoções", "Produtos", "Financeiro", "Relatórios", "Configurações"];
  await loginAs(page, request, "paula@fogoeno.com.br"); // garçom = Funcionário
  await page.goto("/");
  for (const shown of ["Central de Pedidos", "Atendimento"]) await expect(nav).toContainText(shown);
  for (const h of hidden) await expect(nav).not.toContainText(h);

  await loginAs(page, request, "igor@fogoeno.com.br"); // cozinha = Funcionário, sem Atendimento (last init script wins)
  await page.goto("/");
  await expect(nav).toContainText("Central de Pedidos");
  for (const h of ["Atendimento", ...hidden]) await expect(nav).not.toContainText(h);

  await loginAs(page, request, "bruno@fogoeno.com.br"); // manager = Administrador
  await page.goto("/");
  for (const shown of ["Atendimento", "Produtos", "Financeiro", "Relatórios"]) await expect(nav).toContainText(shown);
  await expect(nav).not.toContainText("Configurações");
});

test("módulo desligado some do menu; sem Central de Pedidos a tela inicial é o primeiro módulo ligado", async ({ page, request }) => {
  await setModules(request, SEED_MODULES.filter((m) => m !== "pedidos" && m !== "promocoes")); // + fiscal, off in the seed
  try {
    await page.goto("/");
    await expect(page).toHaveURL(/\/cardapio$/);
    const nav = page.locator("aside nav");
    await page.getByRole("button", { name: /Financeiro/ }).click();
    await expect(nav).toContainText("Contas a Pagar");
    await expect(nav).toContainText("Atendimento"); // Operação is open by default
    for (const off of ["Central de Pedidos", "Promoções", "Emissão Fiscal"]) await expect(nav).not.toContainText(off);
    await page.goto("/emissao-fiscal"); // typed URL: the API says no
    await expect(page.getByText("Você não tem permissão para acessar a Emissão Fiscal.")).toBeVisible();
  } finally {
    await setModules(request, SEED_MODULES);
  }
});

test("Equipe & Permissões: adicionar e editar o papel", async ({ page }) => {
  const email = `e2e-${uid()}@t.com`;
  await page.goto("/config");
  await page.getByRole("button", { name: "Equipe & Permissões" }).click();
  await page.getByLabel("Nome").fill("Carla Caixa");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Papel").selectOption({ label: "Funcionário · Garçom" });
  await page.getByLabel("Senha inicial").fill("segredo1");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(toast(page)).toContainText("Carla Caixa adicionado à equipe");

  const row = page.locator("main div", { hasText: email }).filter({ has: page.getByRole("button", { name: "Editar" }) }).last();
  await row.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Papel").selectOption({ label: "Administrador" });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(row).toContainText("Administrador");
});

test("menu lateral agrupado: grupos abrem e fecham, fechado mostra a tela atual e a soma dos badges", async ({ page }) => {
  await page.goto("/atendimento");
  const operacao = page.getByRole("button", { name: /Operação/ });
  await expect(operacao).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Contas a Pagar" })).toBeHidden(); // Financeiro starts closed here

  await operacao.click();
  await expect(operacao).toHaveAttribute("aria-expanded", "false");
  await expect(operacao).toContainText("Atendimento"); // hint of the current page
  await page.getByRole("button", { name: /Financeiro/ }).click();
  await page.getByRole("link", { name: "Contas a Pagar" }).click();
  await expect(page).toHaveURL(/contas-a-pagar/);
});

test("cadastro de produto composto soma o custo e trava o campo", async ({ page, api }) => {
  const { pao, blend, s } = await burgerKit(api);
  await page.goto("/produtos");
  await page.getByRole("button", { name: "Novo item" }).click();
  await page.getByPlaceholder("Ex.: Hambúrguer da casa").fill(`X-Burger ${s}`);
  await page.locator("label", { hasText: "Preço de venda" }).locator("input").fill("35");
  await page.getByRole("switch").click();
  await page.getByLabel("Produto ou insumo").first().fill(pao.name);
  await page.getByLabel("Quantidade").first().fill("1");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Produto ou insumo").nth(1).fill(blend.name);
  await page.getByLabel("Quantidade").nth(1).fill("0,15");

  const drawer = page.locator(".drawer-panel");
  await expect(drawer).toContainText("Somado automaticamente");
  await expect(drawer.getByText("R$ 8,00").first()).toBeVisible();
  await expect(drawer.locator("label", { hasText: "Custo" }).locator("input")).toHaveCount(0); // locked: no manual cost input

  await page.getByRole("button", { name: "Salvar item" }).click();
  await expect(toast(page)).toContainText(`X-Burger ${s} cadastrado`);
  await expect(page.getByRole("button", { name: new RegExp(`X-Burger ${s}`) })).toContainText("Ficha técnica");
});

test("importar XML da nota lança as entradas em Movimentações", async ({ page, api }) => {
  const { pao } = await burgerKit(api);
  const novo = `Queijo ${uid()}`;
  const xml = `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>
    <det nItem="1"><prod><xProd>${pao.name.toUpperCase()}</xProd><NCM>19059090</NCM><uCom>UN</uCom><qCom>10.0000</qCom><vUnCom>3.00</vUnCom></prod></det>
    <det nItem="2"><prod><xProd>${novo}</xProd><NCM>04069010</NCM><uCom>KG</uCom><qCom>2.5000</qCom><vUnCom>42.50</vUnCom></prod></det>
  </infNFe></NFe></nfeProc>`;

  await page.goto("/produtos");
  await page.getByRole("button", { name: "Movimentações" }).click();
  await expect(page.getByRole("button", { name: "Importar XML" })).toBeVisible(); // always visible, even with history
  await page.locator("input[type=file][accept*=xml]").setInputFiles({ name: "nfe_e2e.xml", mimeType: "text/xml", buffer: Buffer.from(xml) });
  await expect(toast(page)).toContainText("2 itens entraram no estoque");
  await expect(page.getByText(novo)).toBeVisible();
  await expect(page.getByText("nfe_e2e.xml").first()).toBeVisible();

  await page.getByRole("button", { name: "Catálogo" }).click();
  await expect(page.getByRole("button", { name: new RegExp(pao.name) })).toContainText("10 un"); // matched, not duplicated
});

test("Cardápio vincula prato do Catálogo e Organizar prato leva ao cadastro", async ({ page, api }) => {
  const s = uid();
  const prato = await api("POST", `/api/restaurants/${R}/products`, { name: `Moqueca ${s}`, type: "produto", unit: "un", price: 78, cost: 0, ncm: "", cst: "", taxRate: 0, composed: false, components: [] });

  await page.goto("/cardapio");
  await page.getByRole("button", { name: "Adicionar prato" }).click();
  const dialog = page.getByRole("dialog", { name: "Adicionar prato ao cardápio" });
  await dialog.getByLabel("Buscar prato no Catálogo").fill(prato.name);
  await dialog.locator("select").selectOption({ label: "Lanches" });
  await dialog.locator("div", { hasText: prato.name }).getByRole("button", { name: "Adicionar" }).last().click();
  await expect(dialog.getByText("No cardápio")).toBeVisible();
  await dialog.getByRole("button", { name: "Concluir" }).click();

  await page.getByRole("button", { name: `Organizar ${prato.name}` }).click();
  await expect(page.getByText("Nome, preço, composição e tributação são editados no cadastro do Catálogo.")).toBeVisible();
  await page.getByRole("button", { name: "Abrir" }).click();
  await expect(page).toHaveURL(/produtos/);
  await expect(page.locator(".drawer-panel input").first()).toHaveValue(prato.name);
});

test("Contas a Pagar: lançar com mais opções e quitar pelo calendário", async ({ page }) => {
  const desc = `Aluguel ${uid()}`;
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  await page.goto("/contas-a-pagar");
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  const form = page.getByRole("dialog", { name: "Novo lançamento" });
  await form.getByPlaceholder("0,00").fill("6.200,50");
  await form.getByPlaceholder("Ex.: Fornecedor de hortifrúti").fill(desc);
  await expect(form.locator("select")).toHaveCount(0); // categoria/centro de custo start collapsed
  await form.getByRole("button", { name: /Mais opções/ }).click();
  await form.locator("select").first().selectOption({ label: "Aluguel" });
  await form.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(toast(page)).toContainText("Lançamento salvo");

  const row = page.locator("main div", { hasText: desc }).filter({ has: page.getByRole("button", { name: "Quitar" }) }).last();
  await expect(row).toContainText("R$ 6.200,50");
  await row.getByRole("button", { name: "Quitar" }).click();
  const pay = page.getByRole("dialog", { name: "Quitar conta" });
  await pay.getByRole("button", { name: dayLabel(firstOfMonth) }).click();
  await pay.locator("select").selectOption("Transferência");
  await pay.getByRole("button", { name: "Confirmar quitação" }).click();
  await expect(page.locator("main div", { hasText: desc }).filter({ hasText: `em ${dayLabel(firstOfMonth).slice(0, 5)} · Transferência` }).last()).toBeVisible();
});

test("filtro de vencimento personalizado seleciona o intervalo no calendário", async ({ page, api }) => {
  const now = new Date();
  const day = (d: number) => new Date(now.getFullYear(), now.getMonth(), d);
  const s = uid();
  for (const [d, name] of [[15, `Dentro ${s}`], [3, `Fora ${s}`]] as const) {
    await api("POST", `/api/restaurants/${R}/finance-entries`, { kind: "payable", description: name, amount: 10, dueDate: isoDay(day(d)), status: "pending" });
  }

  await page.goto("/contas-a-pagar");
  await page.getByRole("button", { name: /Filtros/ }).click();
  const panel = page.getByRole("dialog", { name: "Filtros" });
  await panel.getByRole("tab", { name: /Vencimento/ }).click();
  await panel.getByRole("button", { name: "Personalizado" }).click();
  await panel.getByRole("button", { name: dayLabel(day(10)) }).click();
  await panel.getByRole("button", { name: dayLabel(day(20)) }).click();
  await panel.getByRole("button", { name: /^Mostrar/ }).click();

  await expect(page.getByRole("button", { name: /Filtros/ })).toContainText("1"); // badge
  await expect(page.getByText(`Dentro ${s}`)).toBeVisible();
  await expect(page.getByText(`Fora ${s}`)).toBeHidden();
});

test("Visão Geral · DRE: entrou/saiu/sobrou e demonstrativo contábil; Administrador não vê a aba", async ({ page, api, request }) => {
  const month = "2031-03"; // isolated from every other test's entries
  const entries = [
    ["receivable", "Vendas salão", 10000],
    ["receivable", "Vendas delivery", 2000],
    ["payable", "Impostos (DAS)", 720],
    ["payable", "Insumos e bebidas", 3600],
    ["payable", "Folha e encargos", 4000],
    ["payable", "Aluguel", 1500]
  ] as const;
  for (const [kind, category, amount] of entries) {
    await api("POST", `/api/restaurants/${R}/finance-entries`, { kind, description: `${category} ${uid()}`, amount, dueDate: `${month}-10`, status: "pending", category });
  }

  await page.goto("/visao-geral");
  await page.getByRole("button", { name: "DRE" }).click();
  await page.getByLabel("Mês").fill(month);
  const main = page.locator("main");
  for (const v of ["R$ 12.000,00", "R$ 9.820,00", "R$ 2.180,00"]) await expect(main).toContainText(v); // entrou, saiu, sobrou

  await page.getByRole("button", { name: "Ver demonstrativo contábil" }).click();
  const line = (label: string) => page.getByRole("row", { name: new RegExp(label) });
  await expect(line("Receita líquida")).toContainText("R$ 11.280,00");
  await expect(line("Lucro bruto")).toContainText("R$ 7.680,00");
  await expect(line("Resultado líquido")).toContainText("R$ 2.180,00");

  await loginAs(page, request, "bruno@fogoeno.com.br");
  await page.goto("/visao-geral");
  await expect(page.getByText("Saldo do período")).toBeVisible();
  await expect(page.getByRole("button", { name: "DRE" })).toHaveCount(0);
});
