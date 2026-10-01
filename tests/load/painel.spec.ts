import { expect, test, type BrowserContext } from "@playwright/test";
import C from "./cenario.mjs";

// PERF-02 com a casa cheia (`npm run carga`): o cliente pede pelo QR da mesa medida num celular, com a Central da cozinha
// aberta em outra página, e mede do POST /api/orders até o card aparecer nela. Cada execução: mesa livre (o card entra
// "Aguardando aceite") → Aceitar na Central → segundo pedido com a mesa já aberta (entra em Recebido) → a mesa é fechada.
const API = "http://localhost:4200";
const WEB = "http://localhost:5273";
const R = C.restaurante;
const TABLE = C.mesaMedida;

// The house's Wi-Fi IP (as the tunnel delivers it): these screens count on the same limits as everyone else.
const sameWifi = (ctx: BrowserContext) => ctx.route(`${API}/**`, (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": C.ipDoWifi } }));
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)];
const s = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

test(`pedido pelo QR → aparece na Central, ${C.execucoes} execuções com a casa cheia`, async ({ browser, request }) => {
  const login = async (user: string) => (await request.post(`${API}/api/auth/login`, { data: { email: `${user}@${R}.example`, password: "senha123" } })).json();
  const waiter = { Authorization: `Bearer ${(await login("garcom")).token}` };
  const close = () => request.post(`${API}/api/restaurants/${R}/tables/${TABLE}/close`, { headers: waiter });
  const { tableCode } = await (await request.get(`${API}/api/restaurants/${R}/tables/${TABLE}/qr`, { headers: waiter })).json();
  await close(); // starts free

  // The kitchen tablet's Central, open the whole time (polling every 4 s).
  const { token, staff } = await login("cozinha");
  const kitchen = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  await sameWifi(kitchen);
  await kitchen.addInitScript((v) => localStorage.setItem("cardapio.dashboard.session", v), JSON.stringify({ token, restaurantId: staff.restaurantId, role: staff.role, staffId: staff.id, name: staff.name }));
  const central = await kitchen.newPage();
  await central.goto("/");

  const free: number[] = [];
  const open: number[] = [];
  for (let i = 1; i <= C.execucoes; i++) {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await sameWifi(phone);
    const guest = await phone.newPage();
    // One order (the first dish still available): ms from its POST until its card ("Pedido #1234, Mesa N"; the code comes with its #) is on the Central.
    const order = async (awaiting: boolean) => {
      await guest.goto(`${WEB}/t/${tableCode}`);
      await guest.getByRole("button", { name: /^Adicionar .+ ao pedido$/ }).first().click();
      await guest.getByRole("button", { name: /Ver carrinho/ }).click();
      await guest.getByRole("button", { name: /Enviar pedido para a cozinha/ }).click();
      const sent = guest.waitForRequest((r) => r.method() === "POST" && r.url() === `${API}/api/orders`).then(() => Date.now());
      const response = guest.waitForResponse((r) => r.request().method() === "POST" && r.url() === `${API}/api/orders`);
      // A random moment of the Central's 4 s poll, as a real order: without it every run takes ~2 polls and lands in the same phase.
      await guest.waitForTimeout(Math.random() * 4000);
      await guest.getByRole("button", { name: /Confirmar e enviar para a cozinha/ }).click();
      const { code } = await (await response).json();
      const card = central.getByRole("group", { name: `Pedido ${code}, Mesa ${TABLE}` });
      await (awaiting ? card.filter({ hasText: "Aguardando aceite" }) : card).waitFor({ timeout: 30_000 });
      const shown = Date.now();
      if (!awaiting) await expect(card).not.toContainText("Aguardando aceite");
      return { card, ms: shown - (await sent) };
    };
    const first = await order(true);
    free.push(first.ms);
    await first.card.getByRole("button", { name: "Aceitar" }).click(); // opens the table
    await expect(central.locator(".toast-bubble")).toContainText(`Mesa ${TABLE} aberta`);
    open.push((await order(false)).ms);
    await phone.close();
    await close();
  }
  await kitchen.close();

  for (const [label, xs] of [["mesa livre, entra Aguardando aceite", free], ["mesa aberta, entra em Recebido", open]] as const)
    console.log(`Pedido → aparece na Central (${label}), ${xs.length} execuções: p50 ${s(pct(xs, 50))} · p95 ${s(pct(xs, 95))} · pior ${s(Math.max(...xs))} · meta ${C.metas.painelS} s`);
  expect(pct([...free, ...open], 95)).toBeLessThanOrEqual(C.metas.painelS * 1000);
});
