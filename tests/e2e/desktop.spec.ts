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

plain("Mesas por papel (F-4): a cozinha não vê Fechar conta; Funcionário não vê Editar ambiente; o Administrador vê os dois", async ({ page, request }) => {
  for (const [email, close, editMap] of [["igor@fogoeno.com.br", 0, 0], ["paula@fogoeno.com.br", 1, 0], ["bruno@fogoeno.com.br", 1, 1]] as const) {
    await loginAs(page, request, email); // the last init script wins
    await page.goto("/mesas");
    await expect(page.getByRole("button", { name: "Lançar pedido" })).toBeVisible(); // the comanda panel is drawn
    await expect(page.getByRole("button", { name: "Fechar conta" }), email).toHaveCount(close);
    await expect(page.getByRole("button", { name: "Editar ambiente" }), email).toHaveCount(editMap);
  }
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
    await page.goto("/emissao-fiscal"); // typed URL of a module that's off: back to the start (G-3; the API says no anyway)
    await expect(page).toHaveURL(/\/cardapio$/);
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
  await page.getByPlaceholder("Ex.: X-Salada").fill(`X-Burger ${s}`);
  await page.locator("label", { hasText: "Preço de venda" }).locator("input").fill("35");
  await page.getByRole("switch").click();
  await page.getByLabel("Produto ou insumo").first().fill(pao.name);
  await page.getByLabel("Quantidade").first().fill("1");
  await page.getByRole("button", { name: "Adicionar componente" }).click();
  await page.getByLabel("Produto ou insumo").nth(1).fill(blend.name);
  await page.getByLabel("Quantidade").nth(1).fill("0,15");

  const drawer = page.locator(".drawer-panel");
  await expect(drawer).toContainText("Calculado pela ficha técnica");
  await expect(drawer.getByText("R$ 8,00").first()).toBeVisible();
  await expect(drawer.locator("label", { hasText: "Custo" }).locator("input")).toHaveCount(0); // locked: no manual cost input

  await page.getByRole("button", { name: "Criar item" }).click();
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
  await expect(page.locator("header [data-restaurant]")).toHaveText("Fogo & Nó");
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

// J-2 (UX-07 · 2a–2e): the Cardápio's category box replaces the browser's prompt and confirm (a browser box here would be
// dismissed by Playwright and nothing would open). Empty name or one taken: the main button stays off; Enter confirms, Esc
// cancels; with dishes, it says how many and which, and Excluir becomes "Mover e excluir" with a destination (item 2).
plain("J-2 · Cardápio: criar, renomear e excluir categoria na caixa do design; com pratos ela diz quantos e quais e pede o destino", async ({ page, request }) => {
  await loginAs(page, request, "gerente@chapa27.example");
  await page.goto("/cardapio");
  const name = `Combos ${uid()}`;
  await page.getByRole("button", { name: "Nova categoria" }).click();
  const create = page.getByRole("dialog", { name: "Nova categoria" });
  await expect(create).toContainText("É a mesma lista do Catálogo de Produtos");
  await expect(create.getByRole("button", { name: "Criar categoria" })).toBeDisabled();
  await create.getByLabel("Nome da categoria").fill("sobremesas");
  await expect(create).toContainText("Já existe uma categoria com esse nome");
  await expect(create.getByRole("button", { name: "Criar categoria" })).toBeDisabled();
  await page.mouse.click(5, 5); // the background does not close it (I-2)
  await create.getByLabel("Nome da categoria").fill(name);
  await create.getByLabel("Nome da categoria").press("Enter");
  await expect(create).toBeHidden();
  await expect(page.locator(".toast-bubble")).toContainText(`Categoria ${name} criada`);
  await expect(page.getByText("Nenhum prato nesta categoria ainda").first()).toBeVisible();

  const rename = page.getByRole("dialog", { name: "Renomear categoria" });
  await page.getByRole("button", { name: `Renomear categoria ${name}` }).click();
  await expect(rename.getByLabel("Nome da categoria")).toHaveValue(name);
  await rename.getByLabel("Nome da categoria").fill("Mudei de ideia");
  await page.keyboard.press("Escape");
  await expect(rename).toBeHidden();
  await expect(page.getByRole("button", { name: `Renomear categoria ${name}` })).toBeVisible();
  await page.getByRole("button", { name: `Renomear categoria ${name}` }).click();
  await rename.getByLabel("Nome da categoria").fill(`${name} da Casa`);
  await rename.getByRole("button", { name: "Salvar" }).click();
  await expect(page.locator(".toast-bubble")).toContainText(`Categoria renomeada para ${name} da Casa`);

  await page.getByRole("button", { name: `Excluir categoria ${name} da Casa` }).click();
  const empty = page.getByRole("dialog", { name: `Excluir “${name} da Casa”?` });
  await expect(empty).toContainText("Ela sai do Catálogo e do Cardápio.");
  await empty.getByRole("button", { name: "Excluir" }).click();
  await expect(page.locator(".toast-bubble")).toContainText(`Categoria ${name} da Casa excluída`);

  await page.getByRole("button", { name: "Excluir categoria Sobremesas" }).click();
  const busy = page.getByRole("dialog", { name: "Excluir “Sobremesas”?" });
  // 4 dishes and, since item 6, 3 insumos (Brownie, Petit gâteau congelado, Calda de chocolate): the API's count.
  await expect(busy).toContainText("Esta categoria tem 7 itens. Para excluir, mova os itens para outra categoria.");
  await expect(busy.getByRole("listitem")).toHaveText(["Brownie com Sorvete", "Petit Gâteau", "Cheesecake de Frutas Vermelhas", "Sundae de Doce de Leite", "e mais 3 itens do Catálogo de Produtos"]);
  await expect(busy.getByRole("button", { name: "Excluir", exact: true })).toHaveCount(0);
  await expect(busy.getByLabel("Mover os 7 itens para:")).toHaveValue("");
  await expect(busy.getByRole("button", { name: "Mover e excluir" })).toBeDisabled(); // no destination yet
  await busy.getByRole("button", { name: "Cancelar" }).click();
  await expect(busy).toBeHidden();
  await expect(page.getByRole("button", { name: "Excluir categoria Sobremesas" })).toBeVisible();
});

// Item 2 (UX-07 · 2d): the API's 409 brings the count the Cardápio didn't know; the box asks where to, and "Mover e excluir"
// moves them and deletes the category in one go.
test("Item 2 · Cardápio: categoria sem prato mas com insumo — a API diz quantos e a caixa move para a categoria escolhida e exclui", async ({ page, api }) => {
  const name = `Molhos ${uid()}`;
  const list = await api<{ id: string; name: string }[]>("POST", `/api/restaurants/${R}/categories`, { name });
  const cat = list.find((c) => c.name === name)!;
  const maionese = `Maionese ${uid()}`;
  await page.goto("/cardapio");
  await expect(page.getByRole("button", { name: `Excluir categoria ${name}` })).toBeVisible();
  // Meanwhile, someone puts an insumo in it from Produtos: this screen's list still says it's empty.
  await api("POST", `/api/restaurants/${R}/products`, { name: maionese, type: "insumo", unit: "kg", price: 0, cost: 18, ncm: "", cst: "", taxRate: 0, composed: false, components: [], categoryId: cat.id });
  await page.getByRole("button", { name: `Excluir categoria ${name}` }).click();
  const box = page.getByRole("dialog", { name: `Excluir “${name}”?` });
  // The list came before the insumo: the Cardápio sees no dish and an old count — the API's 409 brings the real one.
  await expect(box).toContainText("Ela sai do Catálogo e do Cardápio.");
  await box.getByRole("button", { name: "Excluir" }).click();
  await expect(box).toContainText("Esta categoria tem 1 item. Para excluir, mova os itens para outra categoria.");
  await box.getByLabel("Mover o item para:").selectOption({ label: "Lanches" });
  await box.getByRole("button", { name: "Mover e excluir" }).click();
  await expect(box).toBeHidden();
  await expect(page.locator(".toast-bubble")).toContainText(`Categoria ${name} excluída; os itens foram para Lanches`);
  await expect(page.getByRole("button", { name: `Excluir categoria ${name}` })).toHaveCount(0);
  const products = await api<{ name: string; categoryId: string | null }[]>("GET", `/api/restaurants/${R}/products`);
  expect(products.find((p) => p.name === maionese)!.categoryId).toBe(`${R}-cat-1`); // Lanches
});

plain("Produtos: contagem de estoque define o estoque e aparece em Movimentações", async ({ page, request }) => {
  await loginAs(page, request, "gerente@chapa27.example");
  await page.goto("/produtos");
  await page.getByRole("button", { name: /Água com gás 500 ml/ }).click();
  await page.getByRole("button", { name: "Ajustar estoque" }).click();
  await page.getByRole("button", { name: "Contagem" }).click();
  await page.getByLabel("Quantidade do ajuste").fill("24");
  await page.getByLabel("Motivo do ajuste").fill("Inventário de sábado");
  await page.getByRole("button", { name: "Registrar contagem" }).click();
  await expect(page.locator(".toast-bubble")).toContainText("Estoque de Água com gás 500 ml: 24 un");
  // It moved: the unit is locked, and the form says why (A-1.3).
  await expect(page.getByRole("combobox", { name: /^Unidade/ })).toBeDisabled();
  await expect(page.getByText("A unidade não pode mudar depois que o produto teve movimentação. Cadastre um novo produto.")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Movimentações" }).click();
  await expect(page.getByText("Contagem de estoque: Inventário de sábado").first()).toBeVisible();
});

// Item 3 (pendência do J): after the first movement the cost is locked, like the unit, and the form says where to fix it;
// Ajustar estoque takes an optional cost — alone, it corrects the cost without touching the stock — and Movimentações shows it.
test("Item 3 · custo travado depois da primeira movimentação; o Ajustar estoque corrige só o custo e Movimentações mostra", async ({ page, api }) => {
  const name = `Cebola ${uid()}`;
  const p = await api("POST", `/api/restaurants/${R}/products`, { name, type: "insumo", unit: "kg", price: 0, cost: 6, ncm: "", cst: "", taxRate: 0, composed: false, components: [] });
  await api("POST", `/api/restaurants/${R}/stock-movements/adjust`, { productId: p.id, kind: "in", quantity: 10 });
  await page.goto("/produtos");
  await page.getByLabel("Buscar por nome").fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  const sheet = page.locator(".drawer-panel");
  await expect(sheet.getByText(/^Travado depois da primeira movimentação/)).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Custo médio" })).toHaveCount(0); // shown, not editable
  await expect(sheet).toContainText("R$ 6,00");

  await sheet.getByRole("button", { name: "Ajustar estoque" }).click();
  await sheet.getByLabel("Custo por kg (opcional)").fill("5,40");
  await sheet.getByLabel("Motivo do ajuste").fill("nota com preço errado");
  await sheet.getByRole("button", { name: "Registrar custo" }).click();
  await expect(page.locator(".toast-bubble")).toContainText(`Custo de ${name}: R$ 5,40/kg`);
  await expect(sheet).toContainText("R$ 5,40");
  await expect(sheet).toContainText("10 kg"); // the stock didn't move
  await sheet.getByRole("button", { name: "Cancelar" }).click(); // nothing unsaved: closes without asking
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Movimentações", exact: true }).click();
  await expect(page.getByText("Correção de custo: nota com preço errado · custo R$ 5,40/kg")).toBeVisible();
});

plain("Configurações → Salão: sem pedido pelo QR, o Mesas esconde o QR e o QR impresso manda chamar o garçom", async ({ page, browser, request }) => {
  await loginAs(page, request, "dono@chapa27.example");
  await page.goto("/config");
  await page.locator("main").getByRole("button", { name: "Salão", exact: true }).click();
  const qr = page.getByRole("switch", { name: /Clientes pedem pelo QR da mesa/ });
  await expect(qr).toHaveAttribute("aria-checked", "true");
  await qr.click();
  await expect(qr).toHaveAttribute("aria-checked", "false");
  await expect(toast(page)).toContainText("Pedidos da mesa só pelos garçons"); // saved: the switch flips before the API answers
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
    await expect(toast(page)).toContainText("Clientes voltam a pedir pelo QR da mesa");
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

test("Pedir de novo: o carrinho vem com o preço e a disponibilidade de hoje e diz o que ficou de fora", async ({ api, request, browser }) => {
  const kept = await burgerKit(api); // R$ 30,00 when ordered
  const gone = await burgerKit(api);
  const session = crypto.randomUUID();
  const lines = [kept, gone].map((k) => ({ itemId: k.item.id, quantity: 2, notes: "", selectedOptions: [] }));
  expect((await request.post("http://localhost:4200/api/orders", { data: { mode: "delivery", restaurantId: R, lines }, headers: { "X-Session-Id": session } })).status()).toBe(201);
  await api("PATCH", `/api/restaurants/${R}/items/${kept.item.id}`, { price: 34.5 });
  await api("PATCH", `/api/restaurants/${R}/items/${gone.item.id}/sold-out`, { soldOut: true });
  try {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.addInitScript((s) => localStorage.setItem("cardapio.sessionId", s), session);
    const guest = await phone.newPage();
    await guest.goto("http://localhost:5273/history");
    await guest.getByRole("button", { name: /Pedir de novo/ }).first().click();
    await expect(guest).toHaveURL(/\/cart$/);
    await expect(guest.getByRole("status").filter({ hasText: "Ficaram de fora" })).toContainText(`Ficaram de fora por não estarem disponíveis hoje: ${gone.burger.name}.`);
    await expect(guest.getByText(kept.burger.name, { exact: true })).toBeVisible();
    await expect(guest.getByText("R$ 69,00").first()).toBeVisible(); // 2 × 34,50 today, not 2 × 30,00
    await expect(guest.getByText(gone.burger.name, { exact: true })).toHaveCount(0);
    await phone.close();
  } finally {
    await api("PATCH", `/api/restaurants/${R}/items/${gone.item.id}/sold-out`, { soldOut: false });
  }
});

test("G-4 · PIX via sistema pausado: Configurações → Financeiro não oferece o modo; quem já está nele continua como hoje", async ({ page, api }) => {
  const P = `/api/restaurants/${R}`;
  const open = async () => {
    await page.goto("/config");
    await page.locator("main").getByRole("button", { name: "Financeiro", exact: true }).click();
    await expect(page.getByText("Não é necessário abrir subconta").or(page.getByText("O dinheiro cai direto na conta do seu restaurante"))).toBeVisible();
  };
  // Maquininha própria (the seed's): no choice of mode at all — it would be a single option. Its bill close: checklist 14.
  await open();
  await expect(page.getByText("PIX via sistema")).toHaveCount(0);
  await expect(page.getByText("Não é necessário abrir subconta")).toBeVisible();
  // Already on PIX via sistema (no data migrated): the screen as before, and it can switch back.
  await api("PATCH", `${P}/payment-mode`, { paymentMode: "sistema" });
  try {
    await open();
    await expect(page.getByText("PIX via sistema")).toBeVisible();
    await expect(page.getByText("Maquininha própria")).toBeVisible();
  } finally {
    await api("PATCH", `${P}/payment-mode`, { paymentMode: "maquininha_propria" });
  }
});

// J-3 (UX-07 · 1a–1e): the Catálogo by category, in the Cardápio's order — search, category chips, type, collapsible
// sections with their count, "Sem categoria" last, drag (here with the keyboard) to reorder, and the two empty states.
plain("J-3 · Produtos: Catálogo por categoria com busca, chips, tipo, seções recolhíveis e ordem arrastando, a mesma do Cardápio", async ({ page, request }) => {
  await loginAs(page, request, "gerente@chapa27.example");
  const token = await staffToken(request, "gerente@chapa27.example");
  const order = async () => (await (await request.get("http://localhost:4200/api/restaurants/chapa27/categories")).json()).map((c: { name: string }) => c.name);
  // Since item 6 the seed's insumos are all in a category: one without, so "Sem categoria" shows (last).
  await request.post("http://localhost:4200/api/restaurants/chapa27/products", { data: { name: `Guardanapo ${uid()}`, type: "insumo", unit: "un", price: 0, cost: 0.05, ncm: "", cst: "", taxRate: 0, composed: false, components: [] }, headers: { Authorization: `Bearer ${token}` } });
  await page.goto("/produtos");
  const sections = page.locator("section.card button[aria-expanded]");
  await expect(sections.first()).toBeVisible();
  const titles = (await sections.allTextContents()).map((t) => t.replace(/\d+$/, "").trim());
  expect(titles.slice(0, 10)).toEqual(["Hambúrgueres", "Porções", "Bebidas", "Sobremesas", "Carnes", "Pães", "Hortifrúti", "Laticínios", "Molhos", "Embalagens"]);
  expect(titles.at(-1)).toBe("Sem categoria"); // always last
  await expect(page.getByText("Itens antigos · abra o item e escolha uma categoria. Fica sempre no fim.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Hambúrgueres \d+$/ })).toBeVisible(); // name + count
  await expect(page.getByRole("button", { name: /^Filtros/ })).toHaveCount(0); // the type is a segmented now

  // Search: across categories and types; nothing found → the empty state, and Limpar busca brings everything back.
  await page.getByLabel("Buscar por nome").fill("cheesecake");
  await expect(page.getByRole("button", { name: /Cheesecake de Frutas Vermelhas/ })).toBeVisible();
  await expect(sections).toHaveCount(1);
  await expect(page.getByText(/^1 de \d+ itens$/)).toBeVisible();
  await page.getByLabel("Buscar por nome").fill("picanha de sirí");
  await expect(page.getByText("Nenhum item com “picanha de sirí”")).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca" }).last().click();
  await expect(page.getByLabel("Buscar por nome")).toHaveValue("");

  // Type and chip.
  await page.getByRole("button", { name: "Insumos", exact: true }).click();
  await expect(page.getByRole("button", { name: /Bacon em fatias/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Clássico/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page.getByRole("button", { name: "Bebidas", exact: true }).click();
  await expect(sections).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Cerveja long neck/ })).toBeVisible();
  await page.getByRole("button", { name: "Todas", exact: true }).click();

  // Collapse and expand.
  const hamburgueres = page.getByRole("button", { name: /^Hambúrgueres \d+$/ });
  await hamburgueres.click();
  await expect(hamburgueres).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: /^Clássico/ })).toHaveCount(0);
  await hamburgueres.click();
  await expect(page.getByRole("button", { name: /^Clássico/ })).toBeVisible();

  // Drag Porções above Hambúrgueres with the keyboard (Space picks up, ↑ moves, Space drops): the Cardápio's order too.
  try {
    const porcoes = page.locator("section.card", { has: page.getByRole("button", { name: "Reordenar categoria Porções" }) });
    await page.getByRole("button", { name: "Reordenar categoria Porções" }).focus();
    await page.keyboard.press("Space");
    await expect(porcoes).toHaveCSS("opacity", "0.6"); // picked up
    // The sensor takes a frame to listen after the pick-up (the sections fold meanwhile): ↑ again until it moves. Above the
    // first place there is nothing, so an extra ↑ changes nothing.
    await expect(async () => {
      await page.keyboard.press("ArrowUp");
      await expect(porcoes).toHaveAttribute("style", /translate3d\(0px, -\d+px/, { timeout: 500 }); // above Hambúrgueres
    }).toPass({ timeout: 10_000 });
    await page.keyboard.press("Space");
    await expect(toast(page)).toContainText("Categoria Porções movida para cima");
    await expect.poll(order).toEqual(["Porções", "Hambúrgueres", "Bebidas", "Sobremesas"]);
    expect((await sections.allTextContents())[0]).toMatch(/^Porções/);
  } finally {
    const now: { id: string; name: string }[] = await (await request.get("http://localhost:4200/api/restaurants/chapa27/categories/all", { headers: { Authorization: `Bearer ${token}` } })).json();
    if (now[0]?.name === "Porções") await request.post(`http://localhost:4200/api/restaurants/chapa27/categories/${now[0].id}/move`, { data: { direction: "down" }, headers: { Authorization: `Bearer ${token}` } });
  }
  expect(await order()).toEqual(["Hambúrgueres", "Porções", "Bebidas", "Sobremesas"]);

  // The row opens the cadastro.
  await page.getByRole("button", { name: /^Clássico/ }).click();
  await expect(page.locator(".drawer-panel input").first()).toHaveValue("Clássico");
});

plain("J-3 · Produtos de um restaurante sem nenhum item: o estado vazio cadastra o primeiro item ou cria categoria", async ({ page, request }) => {
  const r = await newRestaurant(request);
  await adminApi(request, "PATCH", `/restaurants/${r.id}/status`, { status: "ativo" });
  await loginFreshOwner(page, request, r);
  await page.goto("/produtos");
  await expect(page.getByText("Seu catálogo ainda está vazio")).toBeVisible();
  await expect(page.getByLabel("Buscar por nome")).toHaveCount(0);
  await page.getByRole("button", { name: "Criar categoria" }).click();
  await expect(page.getByRole("dialog", { name: "Nova categoria" })).toContainText("Uma lista só para Catálogo e Cardápio.");
  await page.getByRole("dialog", { name: "Nova categoria" }).getByLabel("Nome da categoria").fill("Carnes");
  await page.getByRole("dialog", { name: "Nova categoria" }).getByRole("button", { name: "Criar categoria" }).click();
  await expect(toast(page)).toContainText("Categoria Carnes criada");
  await expect(page.getByRole("button", { name: "Carnes 0", exact: true })).toBeVisible();
  await expect(page.getByText("Nenhum item nesta categoria ainda.")).toBeVisible();
});

// J-4 (UX-07 · 3a–3g): the cadastro in a sheet — 720 px up to 28 px from the top, sections, errors on the fields, "Nova
// categoria" right there (Criar e usar), Tributação folded with its summary, the opening stock, type and unit locked.
test("J-4 · cadastro em folha: seções, erros nos campos, Nova categoria ali mesmo, Tributação recolhida, saldo inicial e tipo/unidade travados", async ({ page }) => {
  const s = uid();
  await page.goto("/produtos");
  await page.getByRole("button", { name: "Novo item" }).click();
  const sheet = page.getByRole("dialog", { name: "Novo item" });
  await expect(sheet).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))); // dcScaleIn: measure after it
  const box = (await sheet.boundingBox())!;
  expect([Math.round(box.width), Math.round(box.y)]).toEqual([720, 28]);
  for (const t of ["Dados", "Preço e custo", "Estoque", "Ficha técnica"]) await expect(sheet.getByText(t, { exact: true })).toBeVisible();
  await expect(sheet.getByText("Item novo", { exact: true })).toBeVisible();
  const trib = sheet.getByRole("button", { name: /Tributação/ });
  await expect(trib).toHaveAttribute("aria-expanded", "false");
  await expect(trib).toContainText("Não preenchida");
  await expect(sheet.getByPlaceholder("0000.00.00")).toHaveCount(0);

  await sheet.getByRole("button", { name: "Criar item" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Corrija 2 campos para salvar.");
  await expect(sheet).toContainText("Informe o nome do item.");
  await expect(sheet).toContainText("Informe o preço de venda.");

  await sheet.getByRole("button", { name: "Nova categoria" }).click();
  const cat = page.getByRole("dialog", { name: "Nova categoria" });
  await expect(cat).toContainText("Fica selecionada neste item. Vale também para o Cardápio.");
  await cat.getByLabel("Nome da categoria").fill(`Águas ${s}`);
  await cat.getByRole("button", { name: "Criar e usar" }).click();
  await expect(cat).toBeHidden();
  await expect(sheet.getByRole("combobox", { name: /^Categoria/ }).locator("option:checked")).toHaveText(`Águas ${s}`);

  await sheet.getByPlaceholder("Ex.: X-Salada").fill(`Água ${s}`);
  await sheet.locator("label", { hasText: "Preço de venda" }).locator("input").fill("6");
  await sheet.locator("label", { hasText: "Custo inicial" }).locator("input").fill("1,90");
  await expect(sheet.getByText("68,3%")).toBeVisible();
  await sheet.locator("label", { hasText: "Saldo inicial" }).locator("input").fill("48");
  await trib.click();
  await sheet.getByPlaceholder("0000.00.00").fill("2201.10.00");
  await expect(trib).toContainText("Preenchida");
  await sheet.getByRole("button", { name: "Criar item" }).click();
  await expect(toast(page)).toContainText(`Água ${s} cadastrado`);
  await expect(page.getByRole("button", { name: new RegExp(`^Águas ${s} 1$`) })).toBeVisible(); // in its category
  await expect(page.getByRole("button", { name: new RegExp(`Água ${s}`) })).toContainText("48 un");

  await page.getByRole("button", { name: new RegExp(`Água ${s}`) }).click();
  const edit = page.getByRole("dialog", { name: `Água ${s}` });
  await expect(edit.getByRole("combobox", { name: /^Unidade/ })).toBeDisabled(); // the opening stock was its first movement
  await expect(edit).toContainText("O tipo não muda depois de criado.");
  await expect(edit.getByText("Sem alterações")).toBeVisible();
  await edit.getByPlaceholder("Ex.: X-Salada").fill(`Água ${s} gelada`);
  await expect(edit.getByText("Alterações não salvas")).toBeVisible();
});
