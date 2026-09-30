import { test as plain } from "@playwright/test";
import { encode } from "uqr";
import { R, SEED_MODULES, adminApi, asSuperAdmin, burgerKit, dayLabel, expect, isoDay, loginAs, loginFreshOwner, newRestaurant, newTable, setModules, staffToken, tableUrl, test, uid } from "./fixtures";

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

plain("Super Admin: detalhe do restaurante edita os dados, liga/desliga módulo e mostra equipe, configurações e WhatsApp", async ({ page, request }) => {
  const r = await newRestaurant(request);
  await asSuperAdmin(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: r.name }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/restaurantes/${r.id}$`));
  await expect(page.getByText(r.ownerEmail).first()).toBeVisible();
  await expect(page.getByText("Dono", { exact: true })).toBeVisible(); // role in Equipe
  for (const t of ["Clássico", "Maquininha própria", "Não informado", "Aviso de risco ainda não aceito"]) await expect(page.getByText(t, { exact: false }).first()).toBeVisible();

  await page.getByLabel("Contato").fill("Beto · (11) 3333-0000");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(toast(page)).toContainText("Dados salvos");
  await page.getByLabel("Emissão Fiscal").click(); // controlled: flips once the API answers
  await expect(toast(page)).toContainText("Emissão Fiscal desligado");

  await page.reload();
  await expect(page.getByLabel("Contato")).toHaveValue("Beto · (11) 3333-0000");
  await expect(page.getByLabel("Emissão Fiscal")).not.toBeChecked();
  await expect(page.getByLabel("Cardápio")).toBeChecked();
});

plain("Super Admin: resetar senha mostra a provisória uma vez e o próximo login obriga a troca", async ({ page, request }) => {
  const r = await newRestaurant(request);
  await adminApi(request, "PATCH", `/restaurants/${r.id}/status`, { status: "ativo" });
  await asSuperAdmin(page);
  await page.goto(`/admin/restaurantes/${r.id}`);
  await page.getByRole("button", { name: "Resetar senha de Dona Ana" }).click();
  const banner = page.getByRole("status").filter({ hasText: "Nova senha provisória" });
  const provisional = (await banner.locator("span.mono").last().textContent())!.trim();
  expect(provisional.length).toBeGreaterThanOrEqual(12);
  await banner.getByRole("button", { name: "Anotei" }).click();
  await expect(banner).toBeHidden();

  await page.goto("/");
  await page.locator("input[type=email]").fill(r.ownerEmail);
  await page.locator("input[type=password]").fill(provisional);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByRole("heading", { name: "Crie sua senha" })).toBeVisible();
  await page.getByLabel("Senha provisória").fill(provisional);
  await page.getByLabel("Nova senha", { exact: true }).fill("minha-senha-1");
  await page.getByLabel("Repita a nova senha").fill("minha-senha-2");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("não são iguais");
  await page.getByLabel("Repita a nova senha").fill("minha-senha-1");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();
  await expect(page.getByRole("button", { name: "Operação" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Operação" })).toBeVisible(); // flag cleared server-side
});

plain("Super Admin: mensalidade gera o mês, destaca a atrasada, marca como pago e a Minha Fatura do restaurante mostra", async ({ page, request }) => {
  const r = await newRestaurant(request);
  await adminApi(request, "PATCH", `/restaurants/${r.id}/status`, { status: "ativo" });
  await asSuperAdmin(page);
  await page.goto(`/admin/restaurantes/${r.id}`);
  await page.getByLabel("Valor (R$)").fill("199,90");
  await page.getByLabel("Dia de vencimento").fill("5");
  await page.getByRole("button", { name: "Salvar mensalidade" }).click();
  await expect(toast(page)).toContainText("Mensalidade salva");

  await page.getByRole("link", { name: "Mensalidades" }).click();
  await page.getByLabel("Mês").fill("2025-03"); // past month → overdue
  await page.getByRole("button", { name: "Gerar cobranças do mês" }).click();
  await expect(toast(page)).toContainText("03/2025");
  const row = page.locator("[data-status]", { hasText: r.name });
  await expect(row).toHaveAttribute("data-status", "overdue");
  await expect(row).toContainText("R$ 199,90");
  await page.getByRole("button", { name: /Atrasadas/ }).click();
  await row.getByRole("button", { name: "Marcar como pago" }).click();
  await row.getByLabel("Data do pagamento").fill("2025-03-04");
  await row.getByLabel("Forma de pagamento").selectOption("Transferência");
  await row.getByRole("button", { name: "Confirmar" }).click();
  await expect(toast(page)).toContainText(`Pagamento de ${r.name} registrado`);
  await expect(row).toHaveCount(0); // no longer in "Atrasadas"
  await page.getByRole("button", { name: /Pagas/ }).click();
  await expect(row).toContainText("Pago em 04/03/2025 · Transferência");

  await loginFreshOwner(page, request, r);
  await page.goto("/financeiro");
  const line = page.locator("main div", { hasText: "Mensalidade 03/2025" }).last();
  await expect(line).toContainText("Pago em 04/03/2025 · Transferência");
  await expect(page.getByText("R$ 199,90").first()).toBeVisible();
});

test("Sair no menu lateral volta para a tela de login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.locator("input[type=email]")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cardapio.dashboard.session"))).toBeNull();
});

plain("sessão encerrada no meio do uso (restaurante desativado, token vencido) volta para a tela de login em vez de esvaziar a Central", async ({ page, request }) => {
  const r = await newRestaurant(request);
  await adminApi(request, "PATCH", `/restaurants/${r.id}/status`, { status: "ativo" });
  await loginFreshOwner(page, request, r);
  await page.goto("/");
  await expect(page.getByText("Nenhum pedido aqui").first()).toBeVisible();
  await adminApi(request, "PATCH", `/restaurants/${r.id}/status`, { status: "inativo" });
  await expect(page.locator("input[type=email]")).toBeVisible({ timeout: 10_000 }); // the Central polls every 4 s
});

test("Central: card mostra opções e observação; pedido recusado sai do quadro; sem conexão aparece o aviso", async ({ page, api }) => {
  const items = await api("GET", `/api/restaurants/${R}/items`);
  const burger = items.find((i: { id: string }) => i.id === `${R}-burger`);
  const [{ number: table, code }, other] = [await newTable(api), await newTable(api)];
  const lines = [{ itemId: burger.id, quantity: 1, notes: "sem cebola, pão bem tostado", selectedOptions: [{ groupId: "ponto", optionId: "ponto-1" }, { groupId: "extra", optionId: "extra-0" }] }];
  await api("POST", "/api/orders", { mode: "table", restaurantId: R, tableCode: code, lines });
  const refused = await api("POST", "/api/orders", { mode: "table", restaurantId: R, tableCode: other.code, lines: [{ ...lines[0], notes: "recusado" }] });
  await api("POST", `/api/orders/${refused.id}/reject`);

  await page.goto("/");
  const card = page.locator("article").filter({ hasText: `Mesa ${table}` });
  await expect(card).toContainText("Bem passada · Bacon");
  await expect(card).toContainText("Obs: sem cebola, pão bem tostado");
  await expect(page.locator("article").filter({ hasText: "recusado" })).toHaveCount(0);

  await page.route("http://localhost:4200/**", (r) => r.abort());
  await expect(page.getByRole("alert")).toContainText("Sem conexão com o servidor", { timeout: 6_000 });
  await expect(card).toBeVisible(); // the cards stay
  await page.unroute("http://localhost:4200/**");
  await expect(page.getByText("Atualizando em tempo real")).toBeVisible({ timeout: 6_000 });
});

plain("cozinha marca Esgotado no Cardápio e não vê os botões de edição", async ({ page, request }) => {
  await loginAs(page, request, "igor@fogoeno.com.br");
  await page.goto("/cardapio");
  await expect(page.getByRole("button", { name: "Adicionar prato" })).toHaveCount(0);
  const row = page.locator("div").filter({ has: page.getByText("Água com Gás", { exact: true }) }).filter({ has: page.getByRole("button", { name: /Disponível|Esgotado/ }) }).last();
  await row.getByRole("button", { name: /Disponível/ }).click();
  await expect(page.locator(".toast-bubble")).toContainText("marcado esgotado");
  await row.getByRole("button", { name: /Esgotado/ }).click();
  await expect(page.locator(".toast-bubble")).toContainText("disponível novamente");
});

test("Organizar prato: mudar a descrição mantém Ponto da carne e Pão; só os adicionais aparecem para editar", async ({ page, api }) => {
  await page.goto("/cardapio");
  await page.getByRole("button", { name: "Organizar Burger da Casa" }).click();
  const drawer = page.locator(".drawer-panel");
  await expect(drawer.locator("input.field").first()).toHaveValue("Bacon"); // first adicional, not "Ao ponto"
  await drawer.locator("textarea").fill("Blend 180 g, cheddar inglês e cebola caramelizada — descrição nova");
  await drawer.getByRole("button", { name: "Salvar prato" }).click();
  await expect(page.locator(".toast-bubble")).toContainText("Prato salvo");
  const burger = (await api("GET", `/api/restaurants/${R}/items`)).find((i: { id: string }) => i.id === `${R}-burger`);
  expect(burger.optionGroups.map((g: { label: string }) => g.label)).toEqual(["Ponto da carne", "Pão", "Adicionais"]);
});

test("Contas: duplo clique em Salvar cria um lançamento só; Excluir tira da lista", async ({ page, api }) => {
  const description = `Hortifrúti ${uid()}`;
  await page.goto("/contas-a-pagar");
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  await page.getByPlaceholder("0,00").fill("1.234,56");
  await page.getByPlaceholder(/Fornecedor/).fill(description);
  await page.getByRole("button", { name: "Salvar lançamento" }).dblclick();
  await expect(page.getByText(description)).toHaveCount(1);
  const mine = (await api("GET", `/api/restaurants/${R}/finance-entries?kind=payable`)).filter((e: { description: string }) => e.description === description);
  expect(mine.map((e: { amount: number }) => e.amount)).toEqual([1234.56]);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: `Excluir ${description}` }).click();
  await expect(page.locator(".toast-bubble")).toContainText("Lançamento excluído");
  await expect(page.getByText(description)).toHaveCount(0);
});

plain("cabeçalho mostra o nome do restaurante; Atribuir a mim põe o nome de quem clicou", async ({ page, request }) => {
  await loginAs(page, request, "bruno@fogoeno.com.br");
  await page.goto("/atendimento");
  await expect(page.locator("header h1")).toHaveText("Fogo & Nó");
  await page.getByText("Juliana Prado").first().click();
  const assigned = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/tickets/"));
  await page.getByRole("button", { name: "Atribuir a mim" }).click();
  expect((await (await assigned).json()).assignee).toBe("Bruno Castro");
});

plain("serviço de 10% desligado em Configurações → Salão some da comanda do Chapa 27", async ({ page, request }) => {
  await loginAs(page, request, "dono@chapa27.example");
  await page.goto("/config");
  await page.locator("main").getByRole("button", { name: "Salão", exact: true }).click();
  const toggle = page.getByRole("switch", { name: /Cobrar 10% de serviço/ });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  try {
    const { token } = await (await request.post("http://localhost:4200/api/auth/login", { data: { email: "dono@chapa27.example", password: "senha123" } })).json();
    const comanda = await (await request.get("http://localhost:4200/api/restaurants/chapa27/tables/30/comanda", { headers: { Authorization: `Bearer ${token}` } })).json();
    expect([comanda.servicePct, comanda.service]).toEqual([0, 0]);
    await page.goto("/mesas");
    await page.getByRole("button", { name: /^30$/ }).first().click();
    await expect(page.locator("aside.card")).not.toContainText("Serviço");
  } finally {
    await page.goto("/config");
    await page.locator("main").getByRole("button", { name: "Salão", exact: true }).click();
    await page.getByRole("switch", { name: /Cobrar 10% de serviço/ }).click();
    await expect(page.getByRole("switch", { name: /Cobrar 10% de serviço/ })).toHaveAttribute("aria-checked", "true");
  }
});

plain("Cardápio: criar, renomear e excluir categoria; categoria nova aparece vazia para receber pratos", async ({ page, request }) => {
  await loginAs(page, request, "gerente@chapa27.example");
  await page.goto("/cardapio");
  const name = `Combos ${uid()}`;
  page.once("dialog", (d) => d.accept(name));
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await expect(page.locator(".toast-bubble")).toContainText(`Categoria ${name} criada`);
  await expect(page.getByText("Nenhum prato nesta categoria ainda").first()).toBeVisible();
  page.once("dialog", (d) => d.accept(`${name} da Casa`));
  await page.getByRole("button", { name: `Renomear categoria ${name}` }).click();
  await expect(page.getByRole("button", { name: `Excluir categoria ${name} da Casa` })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: `Excluir categoria ${name} da Casa` }).click();
  await expect(page.locator(".toast-bubble")).toContainText("excluída");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir categoria Sobremesas" }).click();
  await expect(page.locator(".toast-bubble")).toContainText("mova ou remova os pratos");
});

plain("Produtos: contagem de estoque define o estoque e aparece em Movimentações", async ({ page, request }) => {
  await loginAs(page, request, "gerente@chapa27.example");
  await page.goto("/produtos");
  await page.getByRole("button", { name: /Água com gás 500 ml/ }).click();
  await page.getByRole("button", { name: "Contagem" }).click();
  await page.getByLabel("Quantidade do ajuste").fill("24");
  await page.getByLabel("Motivo do ajuste").fill("Inventário de sábado");
  await page.getByRole("button", { name: "Registrar contagem" }).click();
  await expect(page.locator(".toast-bubble")).toContainText("Estoque de Água com gás 500 ml: 24 un");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Movimentações" }).click();
  await expect(page.getByText("Contagem de estoque: Inventário de sábado").first()).toBeVisible();
});

plain("Configurações → Salão: sem pedido pelo QR, o Mesas esconde o QR e o QR impresso manda chamar o garçom", async ({ page, browser, request }) => {
  await loginAs(page, request, "dono@chapa27.example");
  await page.goto("/config");
  await page.locator("main").getByRole("button", { name: "Salão", exact: true }).click();
  const qr = page.getByRole("switch", { name: /Clientes pedem pelo QR da mesa/ });
  await expect(qr).toHaveAttribute("aria-checked", "true");
  await qr.click();
  await expect(qr).toHaveAttribute("aria-checked", "false");
  try {
    await page.goto("/mesas");
    await page.getByRole("button", { name: /^03$/ }).first().click();
    await expect(page.getByRole("button", { name: "Lançar pedido" })).toBeVisible();
    await expect(page.getByRole("button", { name: "QR code" })).toHaveCount(0);
    const guest = await browser.newPage();
    await guest.goto(await tableUrl(request, await staffToken(request, "garcom@chapa27.example"), "chapa27", 3));
    await expect(guest.getByText("Neste restaurante os pedidos são feitos pelo garçom")).toBeVisible();
    await guest.close();
  } finally {
    await page.goto("/config");
    await page.locator("main").getByRole("button", { name: "Salão", exact: true }).click();
    await page.getByRole("switch", { name: /Clientes pedem pelo QR da mesa/ }).click();
    await expect(page.getByRole("switch", { name: /Clientes pedem pelo QR da mesa/ })).toHaveAttribute("aria-checked", "true");
  }
});

/** The SVG path TablesQrScreen draws for a text: the QR must encode exactly the table's link. */
const qrPath = (text: string) => encode(text, { ecc: "M", border: 4 }).data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join("");

plain("Mesas → Imprimir QR: uma folha por mesa com o restaurante, a mesa e o QR do link dela; no papel (A4) só as folhas", async ({ page, request }) => {
  await loginAs(page, request, "dono@chapa27.example");
  await page.goto("/mesas");
  await page.getByRole("button", { name: "Imprimir QR" }).click();
  await expect(page).toHaveURL(/\/mesas\/qr$/);
  const sheets = page.locator(".qr-preview .qr-card");
  await expect(sheets).toHaveCount(30);
  const twelve = sheets.filter({ hasText: "Mesa 12" });
  await expect(twelve).toContainText("Chapa 27 Burgers");
  await expect(twelve).toContainText("Aponte a câmera para pedir");
  const url = await tableUrl(request, await staffToken(request, "dono@chapa27.example"), "chapa27", 12);
  expect(await twelve.locator("svg path").getAttribute("d")).toBe(qrPath(url));

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#root")).toBeHidden();
  await expect(page.locator(".qr-print .qr-card")).toHaveCount(30);
  await page.pdf({ path: "test-results/qr-mesas.pdf", format: "A4" }); // for the eye check: 2 per row, 4 per page
  await page.emulateMedia({ media: "screen" });

  // One table, from its own button on the map; the link can be copied.
  await page.goto("/mesas");
  await page.getByRole("button", { name: /^12$/ }).first().click();
  await page.getByRole("button", { name: "QR code" }).click();
  await expect(page).toHaveURL(/\/mesas\/qr\?mesa=12$/);
  await expect(sheets).toHaveCount(1);
  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.locator(".toast-bubble")).toContainText(url);
});

plain("Gerar novo QR: pede confirmação, troca o QR na tela e o link antigo deixa de abrir o cardápio; o garçom não vê o botão", async ({ page, request, browser }) => {
  await loginAs(page, request, "dono@chapa27.example");
  const token = await staffToken(request, "dono@chapa27.example");
  const oldUrl = await tableUrl(request, token, "chapa27", 22);
  await page.goto("/mesas/qr?mesa=22");
  const sheet = page.locator(".qr-preview .qr-card");
  await expect(sheet.locator("svg path")).toHaveAttribute("d", qrPath(oldUrl));

  page.once("dialog", (d) => d.dismiss()); // "Cancelar" changes nothing
  await page.getByRole("button", { name: "Gerar novo QR" }).click();
  expect(await tableUrl(request, token, "chapa27", 22)).toBe(oldUrl);

  let asked = "";
  page.once("dialog", (d) => ((asked = d.message()), d.accept()));
  await page.getByRole("button", { name: "Gerar novo QR" }).click();
  await expect(page.locator(".toast-bubble")).toContainText("QR novo da Mesa 22 gerado");
  expect(asked).toContain("As folhas impressas desta mesa deixarão de funcionar");
  const newUrl = await tableUrl(request, token, "chapa27", 22);
  expect(newUrl).not.toBe(oldUrl);
  await expect(sheet.locator("svg path")).toHaveAttribute("d", qrPath(newUrl));

  const guest = await browser.newPage();
  await guest.goto(oldUrl);
  await expect(guest.getByText("Mesa não encontrada")).toBeVisible();
  await guest.goto(newUrl);
  await expect(guest).toHaveURL(/\/r\/chapa27\/menu/);
  await guest.close();

  const waiter = await browser.newPage();
  await loginAs(waiter, request, "garcom@chapa27.example");
  await waiter.goto("http://localhost:5274/mesas/qr?mesa=22");
  await expect(waiter.locator(".qr-preview .qr-card")).toHaveCount(1);
  await expect(waiter.getByRole("button", { name: "Gerar novo QR" })).toHaveCount(0);
  await waiter.close();
});
