import type { Locator, Page } from "@playwright/test";
import { a11yProblems } from "./a11y";
import { ADMIN_KEY, burgerKit, expect, newTable, R, test, uid } from "./fixtures";

// UX-03 for what only shows after a tap (C-7): every dialog, sheet, popover and form that opens over a screen (or, on the
// phone, as a screen of its own) gets the screen sweep's check — axe WCAG 2.1 A/AA + 44 × 44 targets (tests/e2e/a11y.ts) —
// while it's open, on desktop and phone, light and dark. Logged in as fogo's Dono (fixtures.ts); what each one needs (an
// order waiting for Aceitar, an open comanda, a pending bill) is made through the API first and undone at the end.
// The browser's own confirm boxes (Gerar novo QR; Excluir mesa, conta, cupom) are drawn by the browser, out of axe's
// reach: Gerar novo QR is checked for its text and dismissed. The category box (J-2) is the app's own: checked here.
const P = `/api/restaurants/${R}`;
const pad = (n: number) => String(n).padStart(2, "0");
const line = (itemId: string) => ({ itemId, quantity: 1, notes: "", selectedOptions: [] });
type Step = [name: string, open: (page: Page) => Promise<unknown>, after?: () => Promise<unknown>];

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme, actionTimeout: 10_000, navigationTimeout: 15_000 }); // a step that can't open fails alone, not the run
    test("diálogos, folhas, popovers e formulários abertos", async ({ page, api }, info) => {
      test.setTimeout(300_000);
      const phone = info.project.name === "mobile";

      const { item: burger, pao } = await burgerKit(api); // a dish without options
      const items = await api<{ id: string; name: string; soldOut: boolean; optionGroups: unknown[] }[]>("GET", `${P}/items`);
      const withOptions = items.find((i) => i.optionGroups.length && !i.soldOut)!;
      const burgerName = items.find((i) => i.id === burger.id)!.name;
      const free = await newTable(api); // its first order waits for Aceitar
      const waiting = await api("POST", "/api/orders", { mode: "table", restaurantId: R, tableCode: free.code, lines: [line(burger.id)] });
      const open = await newTable(api); // an open comanda
      await api("POST", `${P}/tables/${open.number}/orders`, { lines: [line(burger.id)] });
      // On the map (a new table waits in the side list, shown only while editing): the first free cell.
      const grid = await api<{ gridSize: number; tables: { gridRow: number | null; gridCol: number | null }[] }>("GET", `${P}/salon-grid`);
      const taken = new Set(grid.tables.map((t) => `${t.gridRow},${t.gridCol}`));
      const cell = Array.from({ length: grid.gridSize ** 2 }, (_, i) => [Math.floor(i / grid.gridSize), i % grid.gridSize]).find(([r, c]) => !taken.has(`${r},${c}`))!;
      await api("PATCH", `${P}/tables/${open.number}/position`, { gridRow: cell[0], gridCol: cell[1] });
      const bill = await api("POST", `${P}/finance-entries`, { kind: "payable", description: `Luz ${uid()}`, amount: 10, dueDate: new Date().toLocaleDateString("sv-SE"), status: "pending" });
      const ticket = (await api<{ id: string }[]>("GET", `${P}/tickets`))[0];
      await page.addInitScript((k) => sessionStorage.setItem("mesapronta.adminKey", k), ADMIN_KEY);

      const chip = (p: Page, n: number) => p.locator(`button[title^="Mesa ${pad(n)} ·"]`).first();
      const dialog = (p: Page, name: string) => expect(p.getByRole("dialog", { name })).toBeVisible();
      const goto = async (p: Page, path: string) => {
        await p.goto(path);
        await expect(p.locator(".skeleton")).toHaveCount(0, { timeout: 8_000 });
      };
      const pixMode = (mode: string) => api("PATCH", `${P}/payment-mode`, { paymentMode: mode });

      const both: Step[] = [
        ["Central: pedido aguardando aceite", (p) => goto(p, "/").then(() => expect(p.getByText("Aguardando aceite").first()).toBeVisible())],
        ["Lançar pedido: opções do prato", async (p) => {
          await goto(p, `/mesas/${open.number}/pedido`);
          await p.getByRole("button", { name: `Adicionar ${withOptions.name}` }).click();
          await dialog(p, withOptions.name);
        }],
        ["Lançar pedido: revisão", async (p) => {
          await goto(p, `/mesas/${open.number}/pedido`);
          await p.getByRole("button", { name: `Adicionar ${burgerName}` }).click();
          await p.getByRole("button", { name: /Revisar e enviar/ }).click();
          await dialog(p, "Revisar pedido");
        }],
        ["Cardápio: Nova categoria", async (p) => {
          await goto(p, "/cardapio");
          if (phone) await p.getByRole("button", { name: "Reordenar categorias" }).click();
          await p.getByRole("button", { name: "Nova categoria" }).click();
          await p.getByRole("dialog", { name: "Nova categoria" }).getByLabel("Nome da categoria").fill("Lanches"); // taken: the error under the field
          await expect(p.getByText("Já existe uma categoria com esse nome")).toBeVisible();
        }],
        ["Cardápio: Excluir categoria com pratos", async (p) => {
          await goto(p, "/cardapio");
          if (phone) await p.getByRole("button", { name: "Reordenar categorias" }).click();
          await p.getByRole("button", { name: "Excluir categoria Lanches" }).click();
          await dialog(p, "Excluir “Lanches”?");
        }],
        ["Cardápio: Adicionar prato", async (p) => {
          await goto(p, "/cardapio");
          await p.getByRole("button", { name: "Adicionar prato" }).click();
          await dialog(p, "Adicionar prato ao cardápio");
        }],
        ["Produtos: Novo item, com ficha técnica", async (p) => {
          await goto(p, "/produtos");
          await p.getByRole("button", { name: "Novo item" }).click();
          await p.getByRole("switch").click();
          await expect(p.getByLabel("Produto ou insumo").first()).toBeVisible();
        }],
        ["Produtos: item com Ajustar estoque", async (p) => {
          await goto(p, "/produtos");
          await p.getByRole("button", { name: new RegExp(pao.name) }).click();
          await expect(p.getByText("Ajustar estoque")).toBeVisible();
        }],
        ["Produtos: Filtros", async (p) => {
          await goto(p, "/produtos");
          await p.getByRole("button", { name: /Filtros/ }).first().click();
          await dialog(p, "Filtros");
        }],
        ["Contas a Pagar: Quitar", async (p) => {
          await goto(p, "/contas-a-pagar");
          await p.locator("main div", { hasText: bill.description }).filter({ has: p.getByRole("button", { name: "Quitar" }) }).last().getByRole("button", { name: "Quitar" }).click();
          await dialog(p, "Quitar conta");
        }],
        ["Contas a Pagar: Filtros, vencimento personalizado", async (p) => {
          await goto(p, "/contas-a-pagar");
          await p.getByRole("button", { name: /Filtros/ }).click();
          await p.getByRole("dialog", { name: "Filtros" }).getByRole("tab", { name: /Vencimento/ }).click();
          await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "Personalizado" }).click();
        }],
        ["Atendimento: Filtros", async (p) => {
          await goto(p, "/atendimento");
          await p.getByRole("button", { name: /Filtros/ }).first().click();
          await dialog(p, "Filtros");
        }],
        ["Notificações", async (p) => {
          await goto(p, "/");
          await p.getByRole("button", { name: /^Notificações/ }).click();
          await expect(p.getByText("Notificações", { exact: true }).last()).toBeVisible();
        }],
        ["Super Admin: Novo restaurante", async (p) => {
          await goto(p, "/admin");
          await p.getByRole("button", { name: "Novo restaurante" }).click();
          await expect(p.getByText("Cadastrar restaurante · entra como pendente")).toBeVisible();
        }]
      ];
      const desktop: Step[] = [
        ["Mesas: Fechar conta (maquininha)", async (p) => {
          await goto(p, "/mesas");
          await chip(p, open.number).click();
          await p.getByRole("button", { name: "Fechar conta" }).click();
          await expect(p.getByRole("button", { name: "Confirmar pagamento" })).toBeVisible();
        }],
        ["Mesas: Fechar conta (PIX pelo sistema)", async (p) => {
          await pixMode("sistema");
          await goto(p, "/mesas");
          await chip(p, open.number).click();
          await p.getByRole("button", { name: "Fechar conta" }).click();
          await expect(p.locator(".modal-panel")).toBeVisible();
        }, () => pixMode("maquininha_propria")],
        ["Mesas: menu da mesa ao editar o ambiente", async (p) => {
          await goto(p, "/mesas");
          await p.getByRole("button", { name: "Editar ambiente" }).click();
          await chip(p, free.number).click({ button: "right" });
          await expect(p.getByRole("button", { name: "Excluir mesa" })).toBeVisible();
        }],
        ["Cardápio: Organizar prato", async (p) => {
          await goto(p, "/cardapio");
          await p.getByRole("button", { name: `Organizar ${withOptions.name}` }).click();
          await expect(p.locator(".drawer-panel")).toBeVisible();
        }],
        ["Contas a Pagar: Novo lançamento, com mais opções", async (p) => {
          await goto(p, "/contas-a-pagar");
          await p.getByRole("button", { name: "Novo lançamento" }).click();
          await p.getByRole("dialog", { name: "Novo lançamento" }).getByRole("button", { name: /Mais opções/ }).click();
        }],
        ["Promoções: Novo cupom", async (p) => {
          await goto(p, "/promocoes");
          await p.getByRole("button", { name: "Novo cupom" }).click();
          await expect(p.locator(".drawer-panel")).toBeVisible();
        }],
        ["Configurações → Aparência: Pré-visualizar", async (p) => {
          await goto(p, "/config");
          await p.getByRole("button", { name: "Aparência" }).click();
          await p.getByRole("button", { name: "Pré-visualizar" }).click();
          await expect(p.locator(".modal-panel")).toBeVisible();
        }]
      ];
      const mobile: Step[] = [
        ["Mesa: Fechar conta (folha)", async (p) => {
          await goto(p, `/mesas/${open.number}`);
          await p.getByRole("button", { name: /Fechar conta/ }).click();
          await expect(p.getByRole("button", { name: "PIX" })).toBeVisible();
        }],
        ["Mesa: Transferir (folha)", async (p) => {
          await goto(p, `/mesas/${open.number}`);
          await p.getByRole("button", { name: /Transferir/ }).first().click();
          await expect(p.getByText("Transferir para qual mesa?")).toBeVisible();
        }],
        ["Mesa: Dividir conta", async (p) => {
          await goto(p, `/mesas/${open.number}`);
          await p.getByRole("button", { name: "Dividir conta" }).click();
          await expect(p.getByRole("button", { name: "Uma pessoa a mais" })).toBeVisible();
        }],
        ["Cardápio: Reordenar categorias", async (p) => {
          await goto(p, "/cardapio");
          await p.getByRole("button", { name: "Reordenar categorias" }).click();
          await expect(p.getByRole("button", { name: /^Descer / }).first()).toBeVisible();
        }],
        ["Minha conta", async (p) => {
          await goto(p, "/");
          await p.getByRole("button", { name: /^Minha conta/ }).click();
        }],
        ["Cardápio: opções do prato (folha)", async (p) => {
          await goto(p, "/cardapio");
          await p.getByRole("button", { name: `Opções de ${withOptions.name}` }).click();
          await expect(p.getByRole("button", { name: "Remover do cardápio" })).toBeVisible();
        }],
        ["Cardápio: Organizar prato (tela)", (p) => goto(p, `/cardapio/${withOptions.id}/editar`)],
        ["Contas a Pagar: Novo lançamento", async (p) => {
          await goto(p, "/contas-a-pagar");
          await p.getByRole("button", { name: "Novo lançamento" }).click();
          await dialog(p, "Novo lançamento");
        }],
        ["Atendimento: conversa (tela)", (p) => goto(p, `/atendimento/${ticket.id}`)],
        ["Promoções: Novo cupom (tela)", (p) => goto(p, "/promocoes/novo")]
      ];

      const problems: string[] = [];
      for (const [name, open, after] of [...both, ...(phone ? mobile : desktop)]) {
        try {
          await open(page);
          // Panels scale and fade in (dcScaleIn): measured mid-animation, their text reads as low contrast. Finite ones only —
          // spinners never end.
          await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
          problems.push(...(await a11yProblems(page, name)));
        } catch (e) {
          problems.push(`${name}: não abriu — ${(e as Error).message.split("\n")[0]}`);
        } finally {
          await after?.();
        }
      }

      // Gerar novo QR asks through the browser's own confirm: its text, then Cancelar (the QR stays the same).
      if (!phone) {
        await goto(page, `/mesas/qr?mesa=${open.number}`);
        const asked = new Promise<string>((ok) => page.once("dialog", (d) => (ok(d.message()), d.dismiss())));
        await page.getByRole("button", { name: "Gerar novo QR" }).click();
        expect(await asked).toBe(`Gerar um QR novo para a Mesa ${pad(open.number)}? As folhas impressas desta mesa deixarão de funcionar.`);
      }

      await api("POST", `/api/orders/${waiting.id}/reject`);
      await api("POST", `${P}/tables/${open.number}/close`, { paymentMethod: "Cartão" });
      await api("PATCH", `${P}/tables/${open.number}/position`, { gridRow: null, gridCol: null });
      await api("DELETE", `${P}/finance-entries/${bill.id}`);
      expect(problems).toEqual([]);
    });
  });
}

// I-2 (UX-08): no modal, side panel or bottom sheet closes on a click on its background — only its own X, Cancelar or
// Continuar — and what was typed stays. The phone's action sheets, the filter popovers and Lançar pedido's dish options
// still close outside: they have no other way out.
test("I-2 · modais, painéis laterais e folhas não fecham ao clicar no fundo e o que foi digitado continua lá; o X e o Cancelar fecham", async ({ page, api }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "mobile";
  const items = await api<{ id: string; name: string; soldOut: boolean; optionGroups: unknown[] }[]>("GET", `${P}/items`);
  const plain = items.find((i) => !i.soldOut && i.optionGroups.length === 0)!;
  const bill = await api("POST", `${P}/finance-entries`, { kind: "payable", description: `Gás ${uid()}`, amount: 10, dueDate: new Date().toLocaleDateString("sv-SE"), status: "pending" });
  const open = await newTable(api); // an open comanda, on the map
  await api("POST", `${P}/tables/${open.number}/orders`, { lines: [line(plain.id)] });
  const grid = await api<{ gridSize: number; tables: { gridRow: number | null; gridCol: number | null }[] }>("GET", `${P}/salon-grid`);
  const taken = new Set(grid.tables.map((t) => `${t.gridRow},${t.gridCol}`));
  const cell = Array.from({ length: grid.gridSize ** 2 }, (_, i) => [Math.floor(i / grid.gridSize), i % grid.gridSize]).find(([r, c]) => !taken.has(`${r},${c}`))!;
  await api("PATCH", `${P}/tables/${open.number}/position`, { gridRow: cell[0], gridCol: cell[1] });
  const pixMode = (mode: string) => api("PATCH", `${P}/payment-mode`, { paymentMode: mode });

  const goto = async (path: string) => {
    await page.goto(path);
    await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 8_000 });
  };
  const tap = (name: string | RegExp) => page.getByRole("button", { name }).first().click();
  const drawer = page.locator(".drawer-panel");
  const dialog = (name: string) => page.getByRole("dialog", { name });
  const fechar = async () => {
    await goto("/mesas");
    await page.locator(`button[title^="Mesa ${String(open.number).padStart(2, "0")} ·"]`).first().click();
    await tap("Fechar conta");
    return page.locator(".modal-panel");
  };
  // [what, how it opens (returns the panel), the buttons that close it, whether it has a background to click (a full-width
  // panel on the phone doesn't)]
  type Case = [string, () => Promise<Locator>, string[], boolean?];
  const cases: Case[] = phone
    ? [
        ["Produto/Insumo", async () => (await goto("/produtos"), await tap("Novo item"), drawer), ["Fechar", "Cancelar"], false],
        ["Adicionar prato (folha)", async () => (await goto("/cardapio"), await tap("Adicionar prato"), dialog("Adicionar prato ao cardápio")), ["Fechar"]],
        ["Novo lançamento (folha)", async () => (await goto("/contas-a-pagar"), await tap("Novo lançamento"), dialog("Novo lançamento")), ["Cancelar"]],
        ["Quitar conta (folha)", async () => (await goto("/contas-a-pagar"), await quitar(), dialog("Quitar conta")), ["Cancelar"]]
      ]
    : [
        ["Produto/Insumo", async () => (await goto("/produtos"), await tap("Novo item"), drawer), ["Fechar", "Cancelar"]],
        ["Cupom", async () => (await goto("/promocoes"), await tap("Novo cupom"), drawer), ["Fechar", "Cancelar"]],
        ["Adicionar prato", async () => (await goto("/cardapio"), await tap("Adicionar prato"), dialog("Adicionar prato ao cardápio")), ["Fechar"]],
        ["Organizar prato", async () => (await goto("/cardapio"), await tap(`Organizar ${plain.name}`), drawer), ["Fechar", "Cancelar"]],
        ["Novo lançamento", async () => (await goto("/contas-a-pagar"), await tap("Novo lançamento"), dialog("Novo lançamento")), ["Cancelar"]],
        ["Quitar conta", async () => (await goto("/contas-a-pagar"), await quitar(), dialog("Quitar conta")), ["Cancelar"]],
        ["Lançar pedido: Revisar pedido", async () => (await goto(`/mesas/${open.number}/pedido`), await tap(`Adicionar ${plain.name}`), await tap(/Revisar e enviar/), dialog("Revisar pedido")), ["Continuar"]],
        ["Mesas: Fechar conta (maquininha)", fechar, ["Cancelar"]],
        ["Mesas: cobrança PIX", async () => (await pixMode("sistema"), await fechar()), ["Fechar"]],
        ["Aparência: Pré-visualizar", async () => (await goto("/config"), await tap("Aparência"), await tap("Pré-visualizar"), page.locator(".modal-panel")), ["Fechar"]]
      ];
  async function quitar() {
    await page.locator("main div", { hasText: bill.description }).filter({ has: page.getByRole("button", { name: "Quitar" }) }).last().getByRole("button", { name: "Quitar" }).click();
  }

  try {
    for (const [name, openIt, closers, background = true] of cases) {
      for (const closer of closers) {
        const panel = await openIt();
        await expect(panel, name).toBeVisible();
        if (background) {
          const field = panel.locator("input:is([type=text],[type=search],:not([type])), textarea, select").first();
          let typed: string | null = null;
          if (await field.count()) {
            if ((await field.evaluate((e) => e.tagName)) === "SELECT") {
              const current = await field.inputValue();
              await field.selectOption((await field.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).find((v) => v !== current)!);
            } else await field.fill("I-2 digitado");
            typed = await field.inputValue();
          }
          await page.mouse.click(5, 5); // the dimmed background, outside the panel
          await expect.soft(panel, `${name}: clicar no fundo não fecha`).toBeVisible();
          if (!(await panel.isVisible())) continue; // closed: on to the next one, so every failing panel is listed
          if (typed !== null) await expect(field, `${name}: o que foi digitado continua lá`).toHaveValue(typed);
        }
        await panel.getByRole("button", { name: closer, exact: true }).first().click();
        await expect(panel, `${name}: ${closer} fecha`).toBeHidden();
      }
    }
  } finally {
    await pixMode("maquininha_propria");
    await api("POST", `${P}/tables/${open.number}/close`, { paymentMethod: "Cartão" });
    await api("PATCH", `${P}/tables/${open.number}/position`, { gridRow: null, gridCol: null });
    await api("DELETE", `${P}/finance-entries/${bill.id}`);
  }
});
