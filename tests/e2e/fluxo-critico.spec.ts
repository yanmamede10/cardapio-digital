import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { brl } from "../../apps/dashboard/src/lib/format";

// E2E-01 (docs/testes/plano-de-testes.md): the demo hamburgueria's critical path, on real screens —
// the customer app (apps/web, :5273) and the dashboard (:5274) against the API (:4200).
const API = "http://localhost:4200";
const WEB = "http://localhost:5273";
const D = "chapa27";
const TABLE = 12;

async function staff(request: APIRequestContext, user: string) {
  return (await (await request.post(`${API}/api/auth/login`, { data: { email: `${user}@chapa27.example`, password: "senha123" } })).json()) as { token: string; staff: { id: string; role: string; name: string; restaurantId: string } };
}
async function asStaff(page: Page, request: APIRequestContext, user: string) {
  const { token, staff: s } = await staff(request, user);
  await page.addInitScript((v) => localStorage.setItem("cardapio.dashboard.session", v), JSON.stringify({ token, restaurantId: s.restaurantId, role: s.role, staffId: s.id, name: s.name }));
}
const get = async (request: APIRequestContext, token: string, path: string) => (await request.get(`${API}/api/restaurants/${D}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json();

test("QR da mesa → pedido com opções → Central → cozinha → fechamento no cartão → estoque, Contas a Receber, turno e Relatórios batem", async ({ browser, page, request }) => {
  const owner = (await staff(request, "dono")).token;
  await request.post(`${API}/api/restaurants/${D}/tables/${TABLE}/close`, { headers: { Authorization: `Bearer ${owner}` } }); // table starts free
  const stockOf = async () => new Map(((await get(request, owner, "/products")) as { name: string; stock: number }[]).map((p) => [p.name, p.stock]));
  const before = { stock: await stockOf(), shift: await get(request, owner, "/shift-stats"), today: (await get(request, owner, "/analytics?period=today")).kpis };

  // 1. The waiter copies the table's QR link: the table's own random code, not its number.
  const { tableCode } = await get(request, owner, `/tables/${TABLE}/qr`);
  expect(tableCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await asStaff(page, request, "garcom");
  await page.goto("/mesas");
  await page.getByRole("button", { name: /^12$/ }).first().click();
  await page.getByRole("button", { name: "QR code" }).click();
  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.locator(".toast-bubble")).toContainText(`/t/${tableCode}`);

  // 2. The customer (a phone) orders through it.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const guest = await phone.newPage();
  await guest.goto(`${WEB}/t/${tableCode}`);
  await expect(guest).toHaveURL(new RegExp(`/r/${D}/menu`));
  await guest.getByText("Cheddar & Bacon", { exact: true }).first().click();
  await guest.getByText("Bem passado", { exact: true }).click();
  await guest.getByText("Bacon extra", { exact: true }).click();
  await guest.getByPlaceholder(/tirar cebola/).fill("sem cebola, pão bem tostado 🍔");
  await guest.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(guest.getByRole("button", { name: /Adicionar ao carrinho/ })).toContainText("R$ 89,80"); // 2 × (38,90 + 6,00)
  await guest.getByRole("button", { name: /Adicionar ao carrinho/ }).click();
  await guest.getByRole("button", { name: "Adicionar Refrigerante lata 350 ml ao pedido" }).first().click();
  await guest.getByRole("button", { name: /Ver carrinho/ }).click();
  await guest.getByRole("button", { name: /Enviar pedido para a cozinha/ }).click();
  const sent = Date.now();
  await guest.getByRole("button", { name: /Confirmar e enviar para a cozinha/ }).click();
  await expect(guest.getByText("Pedido recebido pela cozinha")).toBeVisible();
  await phone.close();

  // 3. It shows up in the kitchen's Central within 5 s, with the choices and the note.
  const kitchen = await browser.newContext({ baseURL: "http://localhost:5274", viewport: { width: 1280, height: 800 }, hasTouch: true, timezoneId: "America/Sao_Paulo" });
  const tablet = await kitchen.newPage();
  await asStaff(tablet, request, "cozinha");
  await tablet.goto("/");
  const card = tablet.locator("article").filter({ hasText: `Mesa ${TABLE}` }).filter({ hasText: "sem cebola" });
  await expect(card).toBeVisible({ timeout: 5_000 });
  expect(Date.now() - sent).toBeLessThan(5_000 + 3_000); // + the page load
  await expect(card).toContainText("Bem passado · Bacon extra");
  await expect(card).toContainText("Obs: sem cebola, pão bem tostado 🍔");
  await expect(card).toContainText("R$ 96,80");

  // 4. The kitchen moves it along.
  await card.getByRole("button", { name: "Aceitar" }).click();
  await card.getByRole("button", { name: /Marcar pronto/ }).click();
  await card.getByRole("button", { name: /Entregar/ }).click();
  await expect(tablet.locator(".toast-bubble")).toContainText(`Mesa ${TABLE}`);
  await kitchen.close();

  // 5. The waiter closes the bill on their own card machine.
  await page.goto("/mesas");
  await page.getByRole("button", { name: /^12$/ }).first().click();
  const side = page.locator("aside.card");
  await expect(side).toContainText("Aguardando pagamento");
  await expect(side).toContainText("R$ 106,48"); // 96,80 + 10% serviço
  await side.getByRole("button", { name: "Fechar conta" }).click();
  await page.getByRole("button", { name: "Cartão" }).click();
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.locator(".toast-bubble")).toContainText(`Conta da Mesa ${TABLE} fechada`);
  await expect(side).toContainText("Livre");

  // 6. Stock went down by the ficha técnica.
  const after = await stockOf();
  const used = (name: string) => Math.round(((before.stock.get(name) ?? 0) - (after.get(name) ?? 0)) * 1000) / 1000;
  // bacon: 2 × 0,04 of the ficha técnica + 2 × 0,03 of the "Bacon extra"
  expect([used("Pão brioche"), used("Blend bovino 150 g"), used("Queijo cheddar fatiado"), used("Bacon em fatias"), used("Molho da casa"), used("Refrigerante lata 350 ml")]).toEqual([2, 2, 0.12, 0.14, 0.04, 1]);

  // 7. Contas a Receber has it, paid by card; Visão Geral's "today" counts it.
  const owners = await browser.newContext({ baseURL: "http://localhost:5274", viewport: { width: 1366, height: 820 }, timezoneId: "America/Sao_Paulo" });
  const office = await owners.newPage();
  await asStaff(office, request, "dono");
  await office.goto("/contas-a-receber");
  const row = office.locator("div").filter({ hasText: new RegExp(`^.*Mesa ${TABLE} · comanda`) }).filter({ hasText: "R$ 106,48" }).last();
  await expect(row).toContainText("Pago");
  await expect(row).toContainText("Cartão");
  const today = new Date().toLocaleDateString("sv-SE");
  const inToday = ((await get(request, owner, "/finance-entries")) as { kind: string; paidOn: string | null; amount: number }[]).filter((e) => e.kind === "receivable" && e.paidOn === today).reduce((t, e) => t + e.amount, 0);
  await office.goto("/visao-geral");
  await expect(office.locator(`[title^="${today.slice(8, 10)}/${today.slice(5, 7)} · entradas"]`)).toHaveAttribute("title", new RegExp(brl(inToday).replace(/[$.]/g, "\\$&")));

  // 8. Turno de hoje and Relatórios: + the items (96,80), one more closed order.
  const shift = await get(request, owner, "/shift-stats");
  const kpis = (await get(request, owner, "/analytics?period=today")).kpis;
  expect(Math.round((shift.shiftRevenue - before.shift.shiftRevenue) * 100) / 100).toBe(96.8);
  expect(shift.closedOrders - before.shift.closedOrders).toBe(1);
  expect(Math.round((kpis.revenue - before.today.revenue) * 100) / 100).toBe(96.8);
  await office.goto("/relatorios");
  await expect(office.getByText(brl(kpis.revenue)).first()).toBeVisible();
  await owners.close();
});

test("cliente vê o aviso quando o item esgota enquanto revisa o pedido (antes a revisão não mostrava erro nenhum)", async ({ browser, request }) => {
  const kitchen = (await staff(request, "cozinha")).token;
  const { tableCode } = await get(request, kitchen, "/tables/29/qr");
  const items = await (await request.get(`${API}/api/restaurants/${D}/items`)).json();
  const polenta = items.find((i: { name: string }) => i.name === "Polenta Frita");
  const soldOut = (v: boolean) => request.patch(`${API}/api/restaurants/${D}/items/${polenta.id}/sold-out`, { data: { soldOut: v }, headers: { Authorization: `Bearer ${kitchen}` } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const guest = await phone.newPage();
  try {
    await guest.goto(`${WEB}/t/${tableCode}`);
    await guest.getByRole("button", { name: "Adicionar Polenta Frita ao pedido" }).first().click();
    await guest.getByRole("button", { name: /Ver carrinho/ }).click();
    await guest.getByRole("button", { name: /Enviar pedido para a cozinha/ }).click();
    await soldOut(true);
    await guest.getByRole("button", { name: /Confirmar e enviar para a cozinha/ }).click();
    await expect(guest.locator(".toast")).toContainText("Polenta Frita está esgotado");
    await expect(guest.getByText("Polenta Frita", { exact: true })).toBeVisible(); // still on the review, cart kept
  } finally {
    await soldOut(false);
    await phone.close();
  }
});
