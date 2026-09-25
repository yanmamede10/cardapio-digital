import type {
  AnalyticsPeriod,
  AnalyticsSummary,
  AppearanceState,
  Coupon,
  CreateCouponRequest,
  CreateFinanceEntryRequest,
  FinanceEntry,
  FiscalInfo,
  MenuCategory,
  MenuItem,
  MenuTemplateId,
  Order,
  OrderStatus,
  OperatingHoursRow,
  PaymentMode,
  Product,
  Restaurant,
  RestaurantProfile,
  RestaurantTable,
  Review,
  SalonGrid,
  ShiftStats,
  StaffMember,
  StaffRole,
  StockMovement,
  SupportTicket,
  TableComanda,
  TicketChannel,
  TicketStatus,
  UpsertMenuItemRequest,
  UpsertProductRequest,
  WaiterCall,
  XmlImportRequest,
  FinanceSummary
} from "@cardapio/shared";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4100";
const SESSION_STORAGE_KEY = "cardapio.dashboard.session";

export interface StaffSession {
  token: string;
  restaurantId: string;
  role: StaffRole;
  staffId: string;
  name: string;
}

function loadSession(): StaffSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

let session: StaffSession | null = loadSession();
// Restaurant id used to build request URLs — comes from the logged-in staff's
// own token once available; the API always re-derives the authoritative id
// from the token itself, this is only for building the right path.
let RESTAURANT_ID = session?.restaurantId ?? "";

function setSession(next: StaffSession | null) {
  session = next;
  RESTAURANT_ID = next?.restaurantId ?? "";
  try {
    if (next) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // localStorage unavailable — session still works for this page load via the module variable
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(init?.headers || {})
      }
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Tente novamente.");
  }
  if (res.status === 401) setSession(null);
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

export function getSession(): StaffSession | null {
  return session;
}

export async function login(email: string, password: string): Promise<StaffSession> {
  const result = await request<{ token: string; staff: { id: string; name: string; role: StaffRole; restaurantId: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  const next: StaffSession = {
    token: result.token,
    restaurantId: result.staff.restaurantId,
    role: result.staff.role,
    staffId: result.staff.id,
    name: result.staff.name
  };
  setSession(next);
  return next;
}

export function logout() {
  setSession(null);
}

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) s.set(k, v);
  });
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const api = {
  getRestaurant: () => request<Restaurant>(`/api/restaurants/${RESTAURANT_ID}`),

  // Orders / kitchen ops
  listOrders: () => request<Order[]>(`/api/restaurants/${RESTAURANT_ID}/orders`),
  acceptOrder: (id: string) => request<Order>(`/api/orders/${id}/accept`, { method: "POST" }),
  rejectOrder: (id: string) => request<Order>(`/api/orders/${id}/reject`, { method: "POST" }),
  setOrderStage: (id: string, stage: OrderStatus) =>
    request<Order>(`/api/orders/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
  getShiftStats: () => request<ShiftStats>(`/api/restaurants/${RESTAURANT_ID}/shift-stats`),

  // Tables
  listTables: () => request<RestaurantTable[]>(`/api/restaurants/${RESTAURANT_ID}/tables`),
  createTable: (seats: number) =>
    request<RestaurantTable>(`/api/restaurants/${RESTAURANT_ID}/tables`, { method: "POST", body: JSON.stringify({ seats }) }),
  getSalonGrid: () => request<SalonGrid>(`/api/restaurants/${RESTAURANT_ID}/salon-grid`),
  setGridSize: (gridSize: number) =>
    request<SalonGrid>(`/api/restaurants/${RESTAURANT_ID}/salon-grid`, { method: "PATCH", body: JSON.stringify({ gridSize }) }),
  setTablePosition: (number: number, gridRow: number | null, gridCol: number | null) =>
    request<SalonGrid>(`/api/restaurants/${RESTAURANT_ID}/tables/${number}/position`, { method: "PATCH", body: JSON.stringify({ gridRow, gridCol }) }),
  renameTable: (number: number, nextNumber: number) =>
    request<SalonGrid>(`/api/restaurants/${RESTAURANT_ID}/tables/${number}`, { method: "PATCH", body: JSON.stringify({ number: nextNumber }) }),
  deleteTable: (number: number) => request<SalonGrid>(`/api/restaurants/${RESTAURANT_ID}/tables/${number}`, { method: "DELETE" }),
  getComanda: (number: number) => request<TableComanda>(`/api/restaurants/${RESTAURANT_ID}/tables/${number}/comanda`),
  closeTable: (number: number) => request<{ ok: true }>(`/api/restaurants/${RESTAURANT_ID}/tables/${number}/close`, { method: "POST" }),
  transferTable: (number: number, toNumber: number) =>
    request<{ ok: true }>(`/api/restaurants/${RESTAURANT_ID}/tables/${number}/transfer`, { method: "POST", body: JSON.stringify({ toNumber }) }),
  getTableQr: (number: number) => request<{ tableCode: string }>(`/api/restaurants/${RESTAURANT_ID}/tables/${number}/qr`),

  // Waiter calls
  listWaiterCalls: () => request<WaiterCall[]>(`/api/restaurants/${RESTAURANT_ID}/waiter-calls`),
  resolveWaiterCall: (callId: string) =>
    request<{ ok: true }>(`/api/restaurants/${RESTAURANT_ID}/waiter-calls/${callId}/resolve`, { method: "POST" }),

  // Menu
  listCategories: () => request<MenuCategory[]>(`/api/restaurants/${RESTAURANT_ID}/categories`),
  listItems: () => request<MenuItem[]>(`/api/restaurants/${RESTAURANT_ID}/items`),
  createItem: (payload: UpsertMenuItemRequest) =>
    request<MenuItem>(`/api/restaurants/${RESTAURANT_ID}/items`, { method: "POST", body: JSON.stringify(payload) }),
  updateItem: (itemId: string, payload: Partial<UpsertMenuItemRequest> & { soldOut?: boolean }) =>
    request<MenuItem>(`/api/restaurants/${RESTAURANT_ID}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  duplicateItem: (itemId: string) =>
    request<MenuItem>(`/api/restaurants/${RESTAURANT_ID}/items/${itemId}/duplicate`, { method: "POST" }),
  deleteItem: (itemId: string) => request<void>(`/api/restaurants/${RESTAURANT_ID}/items/${itemId}`, { method: "DELETE" }),
  uploadItemImage: async (itemId: string, file: File): Promise<MenuItem> => {
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/restaurants/${RESTAURANT_ID}/items/${itemId}/image`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.token}` } : undefined,
        body: form
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
    return res.json();
  },
  moveItem: (itemId: string, direction: "up" | "down") =>
    request<MenuItem[]>(`/api/restaurants/${RESTAURANT_ID}/items/${itemId}/move`, { method: "POST", body: JSON.stringify({ direction }) }),
  moveCategory: (categoryId: string, direction: "up" | "down") =>
    request<MenuCategory[]>(`/api/restaurants/${RESTAURANT_ID}/categories/${categoryId}/move`, { method: "POST", body: JSON.stringify({ direction }) }),

  // Catálogo / estoque
  listProducts: () => request<Product[]>(`/api/restaurants/${RESTAURANT_ID}/products`),
  createProduct: (payload: UpsertProductRequest) =>
    request<Product>(`/api/restaurants/${RESTAURANT_ID}/products`, { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (productId: string, payload: UpsertProductRequest) =>
    request<Product>(`/api/restaurants/${RESTAURANT_ID}/products/${productId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listStockMovements: () => request<StockMovement[]>(`/api/restaurants/${RESTAURANT_ID}/stock-movements`),
  importXml: (payload: XmlImportRequest) =>
    request<{ imported: number }>(`/api/restaurants/${RESTAURANT_ID}/stock-movements/xml`, { method: "POST", body: JSON.stringify(payload) }),

  // Contas a pagar / receber, Emissão Fiscal
  listFinanceEntries: () => request<FinanceEntry[]>(`/api/restaurants/${RESTAURANT_ID}/finance-entries`),
  createFinanceEntry: (payload: CreateFinanceEntryRequest) =>
    request<FinanceEntry>(`/api/restaurants/${RESTAURANT_ID}/finance-entries`, { method: "POST", body: JSON.stringify(payload) }),
  payFinanceEntry: (entryId: string, paidOn: string, paymentMethod: string) =>
    request<FinanceEntry>(`/api/restaurants/${RESTAURANT_ID}/finance-entries/${entryId}/pay`, { method: "POST", body: JSON.stringify({ paidOn, paymentMethod }) }),
  listClosedOrders: () => request<Order[]>(`/api/restaurants/${RESTAURANT_ID}/closed-orders`),

  // Coupons
  listCoupons: (query?: string) => request<Coupon[]>(`/api/restaurants/${RESTAURANT_ID}/coupons${qs({ query })}`),
  createCoupon: (payload: CreateCouponRequest) =>
    request<Coupon>(`/api/restaurants/${RESTAURANT_ID}/coupons`, { method: "POST", body: JSON.stringify(payload) }),
  setCouponActive: (couponId: string, active: boolean) =>
    request<Coupon>(`/api/restaurants/${RESTAURANT_ID}/coupons/${couponId}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  duplicateCoupon: (couponId: string) =>
    request<Coupon>(`/api/restaurants/${RESTAURANT_ID}/coupons/${couponId}/duplicate`, { method: "POST" }),
  deleteCoupon: (couponId: string) => request<void>(`/api/restaurants/${RESTAURANT_ID}/coupons/${couponId}`, { method: "DELETE" }),

  // Support
  listTickets: (params: { status?: TicketStatus | "all"; channel?: TicketChannel | "all" } = {}) =>
    request<SupportTicket[]>(
      `/api/restaurants/${RESTAURANT_ID}/tickets${qs({
        status: params.status && params.status !== "all" ? params.status : undefined,
        channel: params.channel && params.channel !== "all" ? params.channel : undefined
      })}`
    ),
  updateTicket: (ticketId: string, payload: { assignee?: string; status?: TicketStatus }) =>
    request<SupportTicket>(`/api/restaurants/${RESTAURANT_ID}/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  sendTicketMessage: (ticketId: string, text: string) =>
    request<SupportTicket>(`/api/restaurants/${RESTAURANT_ID}/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  listReviews: () => request<Review[]>(`/api/restaurants/${RESTAURANT_ID}/reviews`),
  replyReview: (reviewId: string, text: string) =>
    request<Review>(`/api/restaurants/${RESTAURANT_ID}/reviews/${reviewId}/reply`, { method: "POST", body: JSON.stringify({ text }) }),

  // Reports / finance
  getAnalytics: (period: AnalyticsPeriod) => request<AnalyticsSummary>(`/api/restaurants/${RESTAURANT_ID}/analytics${qs({ period })}`),
  getFinance: () => request<FinanceSummary>(`/api/restaurants/${RESTAURANT_ID}/finance`),

  // Settings
  getProfile: () => request<RestaurantProfile>(`/api/restaurants/${RESTAURANT_ID}/profile`),
  updateProfile: (payload: Partial<RestaurantProfile>) =>
    request<RestaurantProfile>(`/api/restaurants/${RESTAURANT_ID}/profile`, { method: "PATCH", body: JSON.stringify(payload) }),
  getHours: () => request<OperatingHoursRow[]>(`/api/restaurants/${RESTAURANT_ID}/hours`),
  updateHours: (rows: OperatingHoursRow[]) =>
    request<OperatingHoursRow[]>(`/api/restaurants/${RESTAURANT_ID}/hours`, { method: "PATCH", body: JSON.stringify({ rows }) }),
  getStaff: () => request<StaffMember[]>(`/api/restaurants/${RESTAURANT_ID}/staff`),
  inviteStaff: (payload: { name: string; email: string; role: StaffRole }) =>
    request<StaffMember>(`/api/restaurants/${RESTAURANT_ID}/staff`, { method: "POST", body: JSON.stringify(payload) }),
  getFiscal: () => request<FiscalInfo>(`/api/restaurants/${RESTAURANT_ID}/fiscal`),
  updateFiscal: (payload: Partial<FiscalInfo>) =>
    request<FiscalInfo>(`/api/restaurants/${RESTAURANT_ID}/fiscal`, { method: "PATCH", body: JSON.stringify(payload) }),
  getPaymentMode: () => request<{ paymentMode: PaymentMode }>(`/api/restaurants/${RESTAURANT_ID}/payment-mode`),
  setPaymentMode: (paymentMode: PaymentMode) =>
    request<{ paymentMode: PaymentMode }>(`/api/restaurants/${RESTAURANT_ID}/payment-mode`, { method: "PATCH", body: JSON.stringify({ paymentMode }) }),

  // Appearance
  getAppearanceDraft: () => request<AppearanceState>(`/api/restaurants/${RESTAURANT_ID}/appearance/draft`),
  updateAppearanceDraft: (payload: Partial<{ template: MenuTemplateId; brandColor: string; logoUrl: string | null; coverPhotos: string[] }>) =>
    request<AppearanceState>(`/api/restaurants/${RESTAURANT_ID}/appearance/draft`, { method: "PATCH", body: JSON.stringify(payload) }),
  publishAppearance: () => request<AppearanceState>(`/api/restaurants/${RESTAURANT_ID}/appearance/publish`, { method: "POST" }),
  uploadAppearanceFile: async (kind: "logo" | "cover", file: File): Promise<{ url: string } & AppearanceState> => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/restaurants/${RESTAURANT_ID}/appearance/upload`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.token}` } : undefined,
        body: form
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
    return res.json();
  }
};
