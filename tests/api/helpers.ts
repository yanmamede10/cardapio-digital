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

export const product = (over: Record<string, unknown>) => ({ type: "insumo", unit: "un", price: 0, cost: 0, ncm: "", cst: "", taxRate: 0, composed: false, components: [], ...over });
