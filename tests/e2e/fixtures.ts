import { test as base, expect, type APIRequestContext } from "@playwright/test";

const API = "http://localhost:4200";
export const R = "fogo";

type Api = <T = any>(method: string, path: string, body?: unknown) => Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** `page` starts logged in as the owner (session put straight into localStorage); `api` calls the API as that owner for test setup. */
export const test = base.extend<{ token: string; api: Api; theme: "light" | "dark" }>({
  theme: ["light", { option: true }],
  token: async ({ request }, use) => {
    const res = await (await request.post(`${API}/api/auth/login`, { data: { email: "marina@fogoeno.com.br", password: "senha123" } })).json();
    await use(res.token);
  },
  api: async ({ request, token }, use) => {
    await use(apiClient(request, token));
  },
  page: async ({ page, token, theme }, use) => {
    const session = JSON.stringify({ token, restaurantId: R, role: "owner", staffId: "e2e", name: "Marina Duarte" });
    await page.addInitScript(
      ([s, t]) => {
        localStorage.setItem("cardapio.dashboard.session", s);
        localStorage.setItem("mesapronta.theme", t);
      },
      [session, theme]
    );
    await use(page);
  }
});

export { expect };

function apiClient(request: APIRequestContext, token: string): Api {
  return async (method, path, body) => {
    const res = await request.fetch(`${API}${path}`, { method, data: body, headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
    return res.status() === 204 ? undefined : res.json();
  };
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Pão + Blend insumos and a Burger composed of them, linked to the Cardápio. */
export async function burgerKit(api: Api) {
  const s = uid();
  const insumo = (name: string, unit: string, cost: number) =>
    api("POST", `/api/restaurants/${R}/products`, { name, type: "insumo", unit, price: 0, cost, ncm: "", cst: "", taxRate: 0, composed: false, components: [] });
  const pao = await insumo(`Pão ${s}`, "un", 2);
  const blend = await insumo(`Blend ${s}`, "kg", 40);
  const burger = await api("POST", `/api/restaurants/${R}/products`, {
    name: `Burger ${s}`, type: "produto", unit: "un", price: 30, cost: 0, ncm: "", cst: "", taxRate: 0, composed: true,
    components: [{ componentId: pao.id, quantity: 1 }, { componentId: blend.id, quantity: 0.15 }]
  });
  const item = await api("POST", `/api/restaurants/${R}/items`, { productId: burger.id, categoryId: `${R}-cat-1`, name: "", price: 0, shortDescription: "" });
  return { s, pao, blend, burger, item };
}

/** "dd/mm/yyyy" — the calendar's day-button aria-label. */
export const dayLabel = (d: Date) => d.toLocaleDateString("pt-BR");
export const isoDay = (d: Date) => d.toLocaleDateString("sv-SE");

/** For plain (non-fixture) tests: puts a real login for a seeded staff member into the dashboard session. */
export async function loginAs(page: import("@playwright/test").Page, request: APIRequestContext, email: string) {
  const { token, staff } = await (await request.post(`${API}/api/auth/login`, { data: { email, password: "senha123" } })).json();
  const session = JSON.stringify({ token, restaurantId: staff.restaurantId, role: staff.role, staffId: staff.id, name: staff.name });
  await page.addInitScript((s) => localStorage.setItem("cardapio.dashboard.session", s), session);
}
