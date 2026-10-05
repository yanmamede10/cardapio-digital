import type {
  CouponResult,
  CreateOrderRequest,
  MenuCategory,
  MenuItem,
  Order,
  PaymentMethod,
  PublicAppearance,
  Restaurant,
  TableResolveResponse
} from "@cardapio/shared";
import { readableError } from "@cardapio/shared";
import { getSessionId, getTableCode } from "./session";

// The API on this page's own origin (Caddy serves the cardápio and the API on the same address), so no address goes into the
// bundle. VITE_API_URL points the dev server, the tests and the Android dev build at a local API (.env.development, .env.android).
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

/** `message` is for people, in Portuguese (checklist 13); `detail` is the API's own text, for code that tells errors apart. */
export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(readableError(status, detail));
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const table = getTableCode();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": getSessionId(),
        ...(table ? { "X-Table-Code": table } : {}),
        ...(init?.headers || {})
      }
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Tente novamente.");
  }
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore malformed error body
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listRestaurants: (params: { query?: string; cuisine?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.query) qs.set("query", params.query);
    if (params.cuisine) qs.set("cuisine", params.cuisine);
    if (params.sort) qs.set("sort", params.sort);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Restaurant[]>(`/api/restaurants${suffix}`);
  },
  getRestaurant: (id: string) => request<Restaurant>(`/api/restaurants/${id}`),
  getAppearance: (id: string) => request<PublicAppearance>(`/api/restaurants/${id}/appearance`),
  getCategories: (id: string) => request<MenuCategory[]>(`/api/restaurants/${id}/categories`),
  getItems: (id: string, categoryId?: string) => {
    const suffix = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    return request<MenuItem[]>(`/api/restaurants/${id}/items${suffix}`);
  },
  getItem: (restaurantId: string, itemId: string) =>
    request<MenuItem>(`/api/restaurants/${restaurantId}/items/${itemId}`),
  resolveTable: (tableCode: string) => request<TableResolveResponse>(`/api/tables/${tableCode}`),
  getPaymentMethods: () => request<PaymentMethod[]>("/api/payment-methods"),
  applyCoupon: (restaurantId: string, code: string) =>
    request<CouponResult>("/api/coupons/apply", { method: "POST", body: JSON.stringify({ restaurantId, code }) }),
  createOrder: (payload: CreateOrderRequest) =>
    request<Order>("/api/orders", { method: "POST", body: JSON.stringify(payload) }),
  getOrder: (id: string) => request<Order>(`/api/orders/${id}`),
  listOrders: (mode?: string) => request<Order[]>(`/api/orders${mode ? `?mode=${mode}` : ""}`),
  callWaiter: (orderId: string) => request<{ ok: true }>(`/api/orders/${orderId}/call-waiter`, { method: "POST" })
};
