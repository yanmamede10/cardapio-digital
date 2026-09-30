// Shared domain contract for the Cardápio Digital platform.
// Consumed by every frontend (customer app, restaurant dashboard, super admin)
// against the same API, so nothing here should be shaped for one client only.

export type OrderMode = "table" | "delivery";

export interface Restaurant {
  id: string;
  name: string;
  initials: string;
  cuisine: string;
  cuisineTags: string[];
  rating: number;
  reviewCount: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  deliveryFee: number;
  isOpen: boolean;
  reopensAt: string | null;
  promoLabel: string | null;
  coverLabel: string;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

/** An option may consume stock: productId (an insumo or a simple produto) × quantity per unit sold (e.g. Bacon extra = 0,03 kg of bacon). */
export interface OptionStock {
  productId?: string | null;
  quantity?: number;
}

export interface MenuItemOption extends OptionStock {
  id: string;
  label: string;
  priceDelta: number;
}

export interface MenuItemOptionGroup {
  id: string;
  label: string;
  type: "single" | "multi";
  hint: string;
  options: MenuItemOption[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  price: number;
  photoLabel: string;
  imageUrl: string | null;
  tag: string | null;
  tagIcon: string | null;
  soldOut: boolean;
  sortOrder: number;
  scheduleLabel: string;
  optionGroups: MenuItemOptionGroup[];
  productId?: string | null;
}

// ---------------------------------------------------------------------------
// Catálogo / estoque
// ---------------------------------------------------------------------------

export type ProductType = "produto" | "insumo";

export const PRODUCT_UNITS = ["un", "kg", "g", "L", "ml", "porção"] as const;

export interface ProductComponentLine {
  componentId: string;
  name: string;
  unit: string;
  quantity: number;
  /** Component's current (average) cost per unit. */
  unitCost: number;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  unit: string;
  price: number;
  /** Composed products: sum of components × quantity × current cost. */
  cost: number;
  stock: number;
  ncm: string;
  cst: string;
  taxRate: number;
  composed: boolean;
  components: ProductComponentLine[];
}

export interface UpsertProductRequest {
  name: string;
  type: ProductType;
  unit: string;
  price: number;
  cost: number;
  ncm: string;
  cst: string;
  taxRate: number;
  composed: boolean;
  components: { componentId: string; quantity: number }[];
}

export interface StockMovement {
  id: string;
  productName: string;
  unit: string;
  kind: "in" | "out";
  quantity: number;
  source: string;
  createdAt: string;
}

/** NF-e items parsed client-side from the supplier XML. */
export interface XmlImportRequest {
  fileName: string;
  items: { name: string; ncm: string; unit: string; quantity: number; unitCost: number }[];
}

// ---------------------------------------------------------------------------
// Contas a pagar / receber
// ---------------------------------------------------------------------------

export type FinanceEntryKind = "payable" | "receivable";

export interface FinanceEntry {
  id: string;
  kind: FinanceEntryKind;
  description: string;
  amount: number;
  /** "YYYY-MM-DD" */
  dueDate: string;
  status: "pending" | "paid";
  category: string;
  costCenter: string;
  paidOn: string | null;
  paymentMethod: string | null;
}

export interface CreateFinanceEntryRequest {
  kind: FinanceEntryKind;
  description: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
  category?: string;
  costCenter?: string;
}

export const PAYMENT_METHODS = ["Dinheiro", "PIX", "Cartão", "Transferência"] as const;

export interface UpsertMenuItemRequest {
  /** Catalog product to link. When omitted on create, the API makes a Produto from name/price (mobile form). */
  productId?: string;
  categoryId: string;
  name: string;
  shortDescription: string;
  longDescription?: string;
  price: number;
  scheduleLabel?: string;
  extras?: ({ name: string; priceDelta: number } & OptionStock)[];
}

export interface Address {
  id: string;
  label: string;
  detail: string;
  icon: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  label: string;
  note: string;
  icon: string;
}

export interface CartLineSelectedOption extends OptionStock {
  groupId: string;
  groupLabel: string;
  optionId: string;
  label: string;
  priceDelta: number;
}

export interface CartLineInput {
  itemId: string;
  quantity: number;
  notes: string;
  selectedOptions: CartLineSelectedOption[];
}

export interface CartLine extends CartLineInput {
  id: string;
  name: string;
  unitPrice: number;
}

// Single fulfillment pipeline shared by both the kitchen/staff dashboard and
// the customer-facing tracker — table and delivery orders both flow through
// pending -> preparing -> ready, then branch:
//   table:    ready -> served
//   delivery: ready -> out_for_delivery -> delivered
// `cancelled` is terminal from `pending` (staff rejected it before accepting).
export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "served"
  | "cancelled";

export interface Order {
  id: string;
  code: string;
  mode: OrderMode;
  restaurantId: string;
  restaurantName: string;
  tableNumber: number | null;
  guestName: string | null;
  addressId: string | null;
  paymentMethodId: string | null;
  couponCode: string | null;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  round: number;
  createdAt: string;
  // Optional staff-facing display metadata. The management dashboard renders
  // these on the kitchen kanban card; the customer app never reads them, so
  // they stay optional and any client must degrade gracefully without them.
  waiterName?: string | null;
  partySize?: number | null;
  addressLabel?: string | null;
}

export interface CreateOrderRequest {
  mode: OrderMode;
  restaurantId: string;
  tableNumber?: number;
  guestName?: string;
  addressId?: string;
  paymentMethodId?: string;
  couponCode?: string;
  lines: CartLineInput[];
}

export interface CouponResult {
  valid: boolean;
  discountPercent: number;
  message: string;
}

export interface TableResolveResponse {
  restaurantId: string;
  tableNumber: number;
}

export interface RestaurantListQuery {
  query?: string;
  cuisine?: string;
  sort?: "near" | "rating" | "time" | "fee";
}

export interface MenuItemListQuery {
  categoryId?: string;
}

// ---------------------------------------------------------------------------
// Restaurant management dashboard — tables, coupons, support, reports, etc.
// All of this is scoped to a restaurant via the `X-Restaurant-Id` header
// (there is no staff login yet, mirroring the guest-session convention the
// customer app uses via `X-Session-Id`).
// ---------------------------------------------------------------------------

export type TableStatus = "free" | "occupied" | "awaiting_payment";

export interface RestaurantTable {
  id: string;
  restaurantId: string;
  number: number;
  seats: number;
  status: TableStatus;
  openedAt: string | null;
  /** Position on the salon grid (Mapa do Salão). Null until dragged into a cell. */
  gridRow: number | null;
  gridCol: number | null;
}

/** GET/PATCH response for the salon grid — always returned together so the
 *  dashboard can sync both after a resize or a table move in one round trip. */
export interface SalonGrid {
  gridSize: number;
  tables: RestaurantTable[];
}

export interface TableComandaLine {
  orderId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface TableComanda {
  table: RestaurantTable;
  orderIds: string[];
  lines: TableComandaLine[];
  subtotal: number;
  servicePct: number;
  service: number;
  total: number;
}

export interface WaiterCall {
  id: string;
  restaurantId: string;
  tableNumber: number;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

export type CouponKind = "percent" | "fixed" | "combo";
export type CouponChannel = "table" | "delivery" | "both";

export interface Coupon {
  id: string;
  restaurantId: string;
  code: string;
  kind: CouponKind;
  value: number;
  channel: CouponChannel;
  validUntil: string;
  usageLimit: number;
  usedCount: number;
  active: boolean;
  comboItemIds: string[] | null;
  comboPrice: number | null;
}

export interface CreateCouponRequest {
  code: string;
  kind: CouponKind;
  value: number;
  channel: CouponChannel;
  validUntil: string;
  usageLimit: number;
  comboItemIds?: string[];
  comboPrice?: number;
}

export type TicketStatus = "new" | "in_progress" | "resolved";
export type TicketChannel = "table" | "delivery" | "whatsapp";

export interface SupportMessage {
  id: string;
  from: "customer" | "staff";
  authorName: string | null;
  text: string;
  /** WhatsApp only: an image or voice note. */
  mediaType: "image" | "audio" | null;
  /** Signed URL to the private bucket, good for 30–60 min — every ticket read hands out a current one. */
  mediaUrl: string | null;
  createdAt: string;
}

/** Largest photo or voice note through WhatsApp: what Atendimento may send, what the private bucket takes and, from it, the
 *  webhook's body limit (apps/api/src/app.ts). */
export const WHATSAPP_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const WHATSAPP_MEDIA_TOO_BIG = `Arquivo acima de ${WHATSAPP_MEDIA_MAX_BYTES / 1024 / 1024} MB. Envie uma imagem menor ou um áudio mais curto.`;

export type WhatsAppState = "connected" | "connecting" | "disconnected";

/** Configurações → WhatsApp and the Atendimento indicator. termsAcceptedAt null = the Dono never set it up. */
export interface WhatsAppStatus {
  state: WhatsAppState;
  termsAcceptedAt: string | null;
  termsAcceptedBy: string | null;
}

export interface SupportTicket {
  id: string;
  restaurantId: string;
  channel: TicketChannel;
  customerName: string;
  refLabel: string;
  status: TicketStatus;
  assignee: string | null;
  unreadCount: number;
  messages: SupportMessage[];
  createdAt: string;
  lastActivityAt: string;
}

export interface Review {
  id: string;
  restaurantId: string;
  channel: string;
  customerName: string;
  rating: number;
  text: string;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
}

export type StaffRole = "owner" | "manager" | "waiter" | "kitchen";

/** Fixed 3-level hierarchy (no per-person exceptions — see docs/adr/0005). waiter/kitchen are job labels, both Funcionário. */
export const LEVEL = { FUNCIONARIO: 1, ADMINISTRADOR: 2, DONO: 3 } as const;
export const ROLE_LEVEL: Record<StaffRole, number> = { owner: LEVEL.DONO, manager: LEVEL.ADMINISTRADOR, waiter: LEVEL.FUNCIONARIO, kitchen: LEVEL.FUNCIONARIO };
export const ROLE_LABEL: Record<StaffRole, string> = { owner: "Dono", manager: "Administrador", waiter: "Funcionário · Garçom", kitchen: "Funcionário · Cozinha" };
/** Atendimento splits the Funcionário level: the waiter talks to customers, the kitchen doesn't. */
export const SUPPORT_ROLES: StaffRole[] = ["owner", "manager", "waiter"];
/** Any role string outside StaffRole counts as Funcionário. */
export const roleLevel = (role: string | undefined) => ROLE_LEVEL[role as StaffRole] ?? LEVEL.FUNCIONARIO;

/** Contracted modules (ADMIN-03): screens the super admin turns on/off per restaurant — the dashboard menu keys.
 *  Minha Fatura and Configurações aren't here: always on. */
export const PLAN_MODULES = ["pedidos", "cardapio", "mesas", "promocoes", "atendimento", "produtos", "relatorios", "visao", "pagar", "receber", "fiscal"] as const;
export type PlanModule = (typeof PLAN_MODULES)[number];

export interface StaffMember {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: StaffRole;
  invitedAt: string;
}

export interface OperatingHoursRow {
  weekday: number; // 0=Monday .. 6=Sunday
  lunch: string;
  dinner: string;
  isOpen: boolean;
}

export interface RestaurantProfile {
  name: string;
  cuisineCategory: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
}

export type MenuTemplateId = "classico" | "moderno" | "minimalista" | "vibrante" | "editorial" | "galeria";

/** The customer-facing menu page skin: template + brand color + logo/cover photos. */
export interface AppearanceSettings {
  template: MenuTemplateId;
  brandColor: string;
  logoUrl: string | null;
  coverPhotos: string[];
}

/** What the dashboard's Aparência tab edits (draft) vs. what it can publish (live). */
export interface AppearanceState {
  draft: AppearanceSettings;
  live: AppearanceSettings & { publishedAt: string | null };
}

/** What GET /:id/appearance (public, no auth) returns to the menu apps. */
export type PublicAppearance = AppearanceSettings & { publishedAt: string | null };

/** The 5 official Brazilian tax regimes. */
/** Platform-level status (super admin, ADMIN-01). */
export type RestaurantStatus = "ativo" | "inativo" | "pendente";

export interface AdminRestaurant {
  id: string;
  name: string;
  cnpj: string;
  contact: string;
  status: RestaurantStatus;
  createdAt: string;
}

/** Super admin → restaurant detail: editable sign-up data, read-only current settings, team and WhatsApp. */
export interface AdminRestaurantDetail extends AdminRestaurant {
  /** Login of the first Dono (the one created at sign-up); "" if the restaurant has none. */
  ownerEmail: string;
  template: MenuTemplateId;
  brandColor: string;
  paymentMode: PaymentMode;
  taxRegime: TaxRegime | "";
  modules: PlanModule[];
  staff: StaffMember[];
  whatsapp: WhatsAppStatus;
  planPrice: number;
  /** Day of the month the mensalidade falls due (1-28). */
  planDueDay: number;
}

export type TaxRegime ="mei" | "simples_nacional" | "lucro_presumido" | "lucro_real" | "lucro_arbitrado";

export const TAX_REGIME_LABEL: Record<TaxRegime, string> = {
  mei: "MEI",
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  lucro_arbitrado: "Lucro Arbitrado"
};

export interface FiscalInfo {
  cnpj: string;
  legalName: string;
  stateRegistration: string;
  taxRegime: TaxRegime;
  fiscalAddress: string;
}

/** How the restaurant takes payment at the table/counter. */
export type PaymentMode = "sistema" | "maquininha_propria";

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  sistema: "PIX via sistema",
  maquininha_propria: "Maquininha própria"
};

/** A platform charge in Minha Fatura. A mensalidade has its month and date = due date; "overdue" = pending past it (computed). */
export interface BillingCharge {
  id: string;
  restaurantId: string;
  date: string;
  description: string;
  value: number;
  status: "paid" | "pending" | "overdue" | "failed";
  month: string | null;
  paidOn: string | null;
  paymentMethod: string | null;
}

/** Super admin → Mensalidades: every restaurant's monthly charges. */
export type AdminCharge = BillingCharge & { restaurantName: string };

export interface FinanceSummary {
  deliveryFeeMonthToDate: number;
  deliveryFeeCap: number;
  planPrice: number;
  planDueDate: string;
  planModules: string[];
  charges: BillingCharge[];
}

export type AnalyticsPeriod = "today" | "week" | "month" | "custom";

export interface AnalyticsKpis {
  revenue: number;
  revenueDeltaPct: number;
  avgTicket: number;
  avgTicketDeltaPct: number;
  orderCount: number;
  orderCountDeltaPct: number;
  tableOrders: number;
  deliveryOrders: number;
  cancellations: number;
  cancellationsDeltaPct: number;
  cancellationRatePct: number;
}

export interface AnalyticsRevenuePoint {
  label: string;
  tableRevenue: number;
  deliveryRevenue: number;
}

export interface AnalyticsItemStat {
  itemId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface AnalyticsHeatCell {
  hourLabel: string;
  orderCount: number;
  intensity: number;
}

export interface AnalyticsHeatRow {
  dayLabel: string;
  cells: AnalyticsHeatCell[];
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  kpis: AnalyticsKpis;
  revenueSeries: AnalyticsRevenuePoint[];
  topSellers: AnalyticsItemStat[];
  bottomSellers: AnalyticsItemStat[];
  heatmap: AnalyticsHeatRow[];
  reviewAverage: number;
  reviewCount: number;
}

export interface ShiftStats {
  closedOrders: number;
  avgTicket: number;
  avgPrepMinutes: number;
  shiftRevenue: number;
}
