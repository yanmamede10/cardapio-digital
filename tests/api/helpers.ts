// Tiny client for the API under test (started by tests/run.mjs against the throwaway database).
const API = process.env.API_URL ?? "http://localhost:4200";
export const R = "fogo"; // seeded restaurant that has staff

export async function login(email = "marina@fogoeno.com.br") {
  const res = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  const body = await res.json();
  if (!body.token) throw new Error(`login failed for ${email}: ${JSON.stringify(body)}`);
  return body.token as string;
}

/** Returns { status, body } and never throws on HTTP errors, so tests can assert on 4xx. */
export async function call(method: string, path: string, { token, body, session, headers }: { token?: string; body?: unknown; session?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(session ? { "X-Session-Id": session } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (text ? JSON.parse(text) : null) as any };
}

/** Unique suffix so reruns and parallel files never collide on names or table numbers. */
export const uid = () => Math.random().toString(36).slice(2, 7);

/** A table's QR code (what /t/<code> carries — a customer orders with it), read as staff. */
export async function tableCode(restaurantId: string, number: number, token: string): Promise<string> {
  return (await call("GET", `/api/restaurants/${restaurantId}/tables/${number}/qr`, { token })).body.tableCode;
}

/** A free table's first customer order waits in the Central ("awaiting"): accepts it, as staff would, and returns the order
 *  as it is now. Anything else comes back untouched. */
export async function accepted<T extends { status: number; body: { id?: string; status?: string } }>(res: T, token: string): Promise<T> {
  if (res.body?.status !== "awaiting") return res;
  const ok = await call("POST", `/api/orders/${res.body.id}/accept`, { token });
  if (ok.status !== 200) throw new Error(`accept failed: ${JSON.stringify(ok.body)}`);
  return { ...res, body: ok.body };
}

/** A new table (the restaurant's next number) and its QR code. */
export async function newTable(token: string, restaurantId = R) {
  const { number } = (await call("POST", `/api/restaurants/${restaurantId}/tables`, { token, body: { seats: 4 } })).body as { number: number };
  return { number, code: await tableCode(restaurantId, number, token) };
}

export const product = (over: Record<string, unknown>) => ({ type: "insumo", unit: "un", price: 0, cost: 0, ncm: "", cst: "", taxRate: 0, composed: false, components: [], ...over });

export const ADMIN_KEY = process.env.SUPER_ADMIN_KEY ?? "test-admin-key"; // set by tests/run.mjs
/** Every module; the seed leaves "fiscal" off for fogo (demo restaurant). */
export const ALL_MODULES = ["pedidos", "cardapio", "mesas", "promocoes", "atendimento", "produtos", "relatorios", "visao", "pagar", "receber", "fiscal"];
export const SEED_MODULES = ALL_MODULES.filter((m) => m !== "fiscal");
export const setModules = (modules: string[], restaurantId = R) => call("PATCH", `/api/admin/restaurants/${restaurantId}/modules`, { token: ADMIN_KEY, body: { modules } });

/** First login with a provisional password (super admin sign-up/reset): logs in and replaces it, as the dashboard forces. */
export async function firstLogin(email: string, provisional: string, newPassword = "senha-nova-1") {
  const token = (await call("POST", "/api/auth/login", { body: { email, password: provisional } })).body.token as string;
  const res = await call("POST", "/api/auth/password", { token, body: { currentPassword: provisional, newPassword } });
  if (res.status !== 200) throw new Error(`password change failed: ${JSON.stringify(res.body)}`);
  return token;
}
