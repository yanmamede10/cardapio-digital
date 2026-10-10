import type { Page } from "@playwright/test";
import { R, asSuperAdmin, expect, loginAs, newRestaurant, newTable, test } from "./fixtures";

// Round UI-01 (items 14–18): the dashboard's look, on desktop and phone, light and dark. Each test names its item.
const SCREENS = [
  ["Central de Pedidos", "/"],
  ["Mesas", "/mesas"],
  ["Cardápio", "/cardapio"],
  ["Produtos", "/produtos"],
  ["Visão Geral", "/visao-geral"]
] as const;

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 8_000 });
}

/** L-14: hierarchy by type and space — the screen's title in title2 (22 px), nothing heavier than semibold, cards without a
 *  border or a shadow, and at most one filled (brand) button on the screen outside a dialog. */
async function hierarchy(page: Page, where: string) {
  const got = await page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    };
    const outside = (e: Element) => !e.closest('[role="dialog"],[role="alertdialog"]');
    const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim().toLowerCase();
    const rgb = (h: string) => `rgb(${h.match(/[\da-f]{2}/g)!.map((x) => parseInt(x, 16)).join(", ")})`;
    const title = document.querySelector("h1");
    return {
      title: title ? getComputedStyle(title).fontSize : "sem título",
      bold: [...document.querySelectorAll("body *")]
        .filter((e) => visible(e) && outside(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && Number(getComputedStyle(e).fontWeight) >= 700)
        .map((e) => (e.textContent ?? "").trim().slice(0, 30)),
      boxed: [...document.querySelectorAll(".card")]
        .filter((e) => visible(e) && outside(e) && !e.closest(".modal-panel,.drawer-panel"))
        .filter((e) => {
          const s = getComputedStyle(e);
          return s.boxShadow !== "none" || (s.borderTopWidth !== "0px" && s.borderTopColor !== "rgba(0, 0, 0, 0)");
        })
        .map((e) => (e.textContent ?? "").trim().slice(0, 30)),
      filled: [...document.querySelectorAll("button, a")]
        .filter((e) => visible(e) && outside(e) && getComputedStyle(e).backgroundColor === rgb(brand))
        .map((e) => e.getAttribute("aria-label") ?? (e.textContent ?? "").trim())
    };
  });
  expect(got.title, `${where}: título da tela em title2`).toBe("22px");
  expect(got.bold, `${where}: nada mais pesado que semibold`).toEqual([]);
  expect(got.boxed, `${where}: cartão sem borda nem sombra`).toEqual([]);
  expect(got.filled.length, `${where}: no máximo um botão principal — ${got.filled.join(" | ")}`).toBeLessThanOrEqual(1);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme === "light" ? "claro" : "escuro"}`, () => {
    test.use({ theme });

    test("L-14 · hierarquia: título da tela em title2, sem negrito pesado, cartões sem caixa, um botão principal por tela", async ({ page, request, api }) => {
      test.setTimeout(120_000);
      await loginAs(page, request, "dono@chapa27.example");
      for (const [name, path] of SCREENS) {
        await open(page, path);
        await expect(page.locator("h1").first()).toHaveText(new RegExp(`^${name}`, "i")); // the phone says "Mesas e Comandas", "Visão geral"
        await hierarchy(page, name);
      }
      // The Central with new orders waiting (two, at Fogo & Nó): each card's Aceitar is an action of its own, not the screen's.
      const burger = (await api("GET", `/api/restaurants/${R}/items`)).find((i: { id: string }) => i.id === `${R}-burger`);
      const lines = [{ itemId: burger.id, quantity: 1, selectedOptions: [{ groupId: "ponto", optionId: "ponto-1" }] }];
      const orders = [await api("POST", "/api/orders", { mode: "table", restaurantId: R, tableCode: (await newTable(api)).code, lines }), await api("POST", "/api/orders", { mode: "table", restaurantId: R, tableCode: (await newTable(api)).code, lines })];
      try {
        await loginAs(page, request, "marina@fogoeno.com.br");
        await open(page, "/");
        await expect(page.getByRole("button", { name: /^Aceitar/ }).first()).toBeVisible();
        await hierarchy(page, "Central com pedidos novos");
      } finally {
        for (const o of orders) await api("POST", `/api/orders/${o.id}/reject`);
      }
      await newRestaurant(request); // a pending one: its row offers Ativar
      await asSuperAdmin(page);
      await open(page, "/admin");
      await hierarchy(page, "Super Admin");
    });
  });
}

// L-15: glass only on what floats over the content — menus, the phone's search and tab bars (sheets' bars too) — never on the
// page itself (the desktop's header and sidebar); with "reduzir transparência", solid.
test("L-15 · vidro só no que flutua (menu, barra de busca e de abas do celular); cabeçalho e menu lateral sólidos; sem vidro com reduzir transparência", async ({ page, request }, info) => {
  const blur = (css: string) => page.locator(css).first().evaluate((e) => getComputedStyle(e).backdropFilter);
  await loginAs(page, request, "dono@chapa27.example");
  if (info.project.name === "mobile") {
    await open(page, "/cardapio");
    expect(await blur("main .glass")).toContain("blur");
    expect(await blur("nav.glass")).toContain("blur");
    await page.getByRole("button", { name: /^Notificações/ }).click();
    expect(await blur("header .glass")).toContain("blur");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    expect(await blur("nav.glass")).toBe("none");
    const [bg, surface] = await page.locator("nav.glass").evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(document.body).getPropertyValue("--surface").trim()]);
    expect(bg).toBe(`rgb(${surface.match(/[\da-f]{2}/gi)!.map((x) => parseInt(x, 16)).join(", ")})`);
  } else {
    await open(page, "/");
    expect(await blur("header")).toBe("none");
    expect(await blur("aside")).toBe("none");
    await page.getByRole("button", { name: /^Notificações/ }).click();
    expect(await blur("header .glass")).toContain("blur");
  }
});

// L-16: one icon style (solid) at three sizes — whatever the icon sits in, it renders at 16, 20 or 24 px.
test("L-16 · ícones: só solid, em 16, 20 ou 24 px, nas telas principais e no Super Admin", async ({ page, request }) => {
  test.setTimeout(90_000);
  const icons = (where: string) =>
    page.evaluate((where) => {
      const shown = [...document.querySelectorAll('i[class*="fa-"]')].filter((e) => e.getBoundingClientRect().width > 0);
      return shown.flatMap((e) => {
        const size = getComputedStyle(e).fontSize;
        const style = [...e.classList].find((c) => /^fa-(regular|light|thin|duotone|brands)$/.test(c) && !e.classList.contains("fa-whatsapp"));
        return ["16px", "20px", "24px"].includes(size) && !style ? [] : [`${where}: ${e.className} ${size}`];
      });
    }, where);
  await loginAs(page, request, "dono@chapa27.example");
  const wrong: string[] = [];
  for (const [name, path] of SCREENS) {
    await open(page, path);
    wrong.push(...(await icons(name)));
  }
  await asSuperAdmin(page);
  await open(page, "/admin");
  wrong.push(...(await icons("Super Admin")));
  expect(wrong).toEqual([]);
});
