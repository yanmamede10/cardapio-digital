import type {
  Address as ApiAddress,
  BillingCharge as ApiBillingCharge,
  AppearanceState,
  CartLine,
  Coupon as ApiCoupon,
  FinanceEntry as ApiFinanceEntry,
  FiscalInfo,
  MenuItem as ApiMenuItem,
  MenuItemOptionGroup,
  MenuTemplateId,
  Order as ApiOrder,
  OperatingHoursRow,
  PaymentMethod as ApiPaymentMethod,
  Product as ApiProduct,
  ProductType,
  PublicAppearance,
  Restaurant as ApiRestaurant,
  RestaurantProfile,
  RestaurantTable as ApiRestaurantTable,
  Review as ApiReview,
  StaffMember as ApiStaffMember,
  StockMovement as ApiStockMovement,
  SupportMessage as ApiSupportMessage,
  SupportTicket as ApiSupportTicket,
  TableStatus,
  WaiterCall as ApiWaiterCall
} from "@cardapio/shared";
import type {
  Address,
  BillingCharge,
  Coupon,
  FinanceEntry,
  MenuItem,
  OperatingHour,
  Order,
  OrderLine,
  PaymentMethod,
  Product,
  ProductComponent,
  Restaurant,
  RestaurantTable,
  Review,
  StaffMember,
  StockMovement,
  SupportMessage,
  SupportTicket,
  WaiterCall
} from "@prisma/client";
import { round2 } from "./pricing.js";
import { signedMediaUrl } from "./storage.js";

export function serializeRestaurant(r: Restaurant): ApiRestaurant {
  return {
    id: r.id,
    name: r.name,
    initials: r.initials,
    cuisine: r.cuisine,
    cuisineTags: JSON.parse(r.cuisineTagsJson),
    rating: r.rating,
    reviewCount: r.reviewCount,
    etaMinMinutes: r.etaMinMinutes,
    etaMaxMinutes: r.etaMaxMinutes,
    deliveryFee: r.deliveryFee,
    isOpen: r.isOpen,
    reopensAt: r.reopensAt,
    promoLabel: r.promoLabel,
    coverLabel: r.coverLabel
  };
}

export function serializeMenuItem(item: MenuItem, categoryName: string): ApiMenuItem {
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    categoryId: item.categoryId,
    categoryName,
    name: item.name,
    shortDescription: item.shortDescription,
    longDescription: item.longDescription,
    price: item.price,
    photoLabel: item.photoLabel,
    imageUrl: item.imageUrl,
    tag: item.tag,
    tagIcon: item.tagIcon,
    soldOut: item.soldOut,
    sortOrder: item.sortOrder,
    scheduleLabel: item.scheduleLabel,
    optionGroups: JSON.parse(item.optionGroupsJson) as MenuItemOptionGroup[],
    productId: item.productId
  };
}

export function serializeAddress(a: Address): ApiAddress {
  return { id: a.id, label: a.label, detail: a.detail, icon: a.icon, isDefault: a.isDefault };
}

export function serializePaymentMethod(p: PaymentMethod): ApiPaymentMethod {
  return { id: p.id, label: p.label, note: p.note, icon: p.icon };
}

export function serializeOrder(order: Order & { lines: OrderLine[] }): ApiOrder {
  const lines: CartLine[] = order.lines.map((l) => ({
    id: l.id,
    itemId: l.itemId,
    name: l.name,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    notes: l.notes,
    selectedOptions: JSON.parse(l.selectedOptionsJson)
  }));
  return {
    id: order.id,
    code: order.code,
    mode: order.mode as ApiOrder["mode"],
    restaurantId: order.restaurantId,
    restaurantName: order.restaurantName,
    tableNumber: order.tableNumber,
    guestName: order.guestName,
    addressId: order.addressId,
    paymentMethodId: order.paymentMethodId,
    couponCode: order.couponCode,
    lines,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    total: order.total,
    status: order.status as ApiOrder["status"],
    round: order.round,
    createdAt: order.createdAt.toISOString(),
    waiterName: order.waiterName,
    takeaway: order.takeaway
  };
}

export function serializeTable(t: RestaurantTable, status: TableStatus): ApiRestaurantTable {
  return {
    id: t.id,
    restaurantId: t.restaurantId,
    number: t.number,
    seats: t.seats,
    status,
    openedAt: t.openedAt ? t.openedAt.toISOString() : null,
    gridRow: t.gridRow ?? null,
    gridCol: t.gridCol ?? null
  };
}

export function serializeWaiterCall(c: WaiterCall): ApiWaiterCall {
  return {
    id: c.id,
    restaurantId: c.restaurantId,
    tableNumber: c.tableNumber,
    reason: c.reason,
    createdAt: c.createdAt.toISOString(),
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null
  };
}

export function serializeCoupon(c: Coupon): ApiCoupon {
  return {
    id: c.id,
    restaurantId: c.restaurantId,
    code: c.code,
    kind: c.kind as ApiCoupon["kind"],
    value: c.value,
    channel: c.channel as ApiCoupon["channel"],
    validUntil: c.validUntil.toISOString(),
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    active: c.active,
    comboItemIds: c.comboItemIdsJson ? JSON.parse(c.comboItemIdsJson) : null,
    comboPrice: c.comboPrice ?? null
  };
}

export async function serializeTicket(t: SupportTicket & { messages: SupportMessage[] }): Promise<ApiSupportTicket> {
  return {
    id: t.id,
    restaurantId: t.restaurantId,
    channel: t.channel as ApiSupportTicket["channel"],
    customerName: t.customerName,
    refLabel: t.refLabel,
    status: t.status as ApiSupportTicket["status"],
    assignee: t.assignee,
    unreadCount: t.unreadCount,
    messages: await Promise.all(t.messages.map(serializeMessage)),
    createdAt: t.createdAt.toISOString(),
    lastActivityAt: t.lastActivityAt.toISOString()
  };
}

export async function serializeMessage(m: SupportMessage): Promise<ApiSupportMessage> {
  return {
    id: m.id,
    from: m.from as ApiSupportMessage["from"],
    authorName: m.authorName,
    text: m.text,
    mediaType: m.mediaType as ApiSupportMessage["mediaType"],
    // Private bucket: only a short-lived signed URL ever leaves the API — and only through support.ts (Atendimento guard).
    mediaUrl: m.mediaKey ? await signedMediaUrl(m.mediaKey).catch((err) => (console.error(err), null)) : null,
    createdAt: m.createdAt.toISOString()
  };
}

export function serializeReview(r: Review): ApiReview {
  return {
    id: r.id,
    restaurantId: r.restaurantId,
    channel: r.channel,
    customerName: r.customerName,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
    reply: r.reply,
    repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null
  };
}

export function serializeStaff(s: StaffMember): ApiStaffMember {
  return {
    id: s.id,
    restaurantId: s.restaurantId,
    name: s.name,
    email: s.email,
    role: s.role as ApiStaffMember["role"],
    invitedAt: s.invitedAt.toISOString()
  };
}

export function serializeHours(rows: OperatingHour[]): OperatingHoursRow[] {
  return rows
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((h) => ({ weekday: h.weekday, lunch: h.lunch, dinner: h.dinner, isOpen: h.isOpen }));
}

export function serializeProfile(r: Restaurant): RestaurantProfile {
  return {
    name: r.name,
    cuisineCategory: r.cuisine,
    description: r.description,
    logoUrl: r.logoUrl ?? null,
    coverUrl: r.coverUrl ?? null
  };
}

export function serializeAppearanceState(r: Restaurant): AppearanceState {
  return {
    draft: {
      template: r.draftTemplate as MenuTemplateId,
      brandColor: r.draftBrandColor,
      logoUrl: r.draftLogoUrl ?? null,
      coverPhotos: JSON.parse(r.draftCoverPhotosJson)
    },
    live: {
      template: r.template as MenuTemplateId,
      brandColor: r.brandColor,
      logoUrl: r.appearanceLogoUrl ?? null,
      coverPhotos: JSON.parse(r.coverPhotosJson),
      publishedAt: r.appearancePublishedAt ? r.appearancePublishedAt.toISOString() : null
    }
  };
}

export function serializePublicAppearance(r: Restaurant): PublicAppearance {
  return {
    template: r.template as MenuTemplateId,
    brandColor: r.brandColor,
    logoUrl: r.appearanceLogoUrl ?? null,
    coverPhotos: JSON.parse(r.coverPhotosJson),
    publishedAt: r.appearancePublishedAt ? r.appearancePublishedAt.toISOString() : null
  };
}

export function serializeFiscal(r: Restaurant): FiscalInfo {
  return {
    cnpj: r.cnpj,
    legalName: r.legalName,
    stateRegistration: r.stateRegistration,
    taxRegime: r.taxRegime as FiscalInfo["taxRegime"],
    fiscalAddress: r.fiscalAddress
  };
}

/** "overdue" is never stored: a pending charge whose due date is before today (server zone, pinned in app.ts). */
export function serializeCharge(c: BillingCharge): ApiBillingCharge {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    id: c.id,
    restaurantId: c.restaurantId,
    date: c.date.toISOString(),
    description: c.description,
    value: c.value,
    status: c.status === "pending" && c.date < today ? "overdue" : (c.status as ApiBillingCharge["status"]),
    month: c.month,
    paidOn: c.paidOn,
    paymentMethod: c.paymentMethod
  };
}

export function serializeProduct(p: Product & { components: (ProductComponent & { component: Product })[]; _count?: { movements: number } }): ApiProduct {
  const components = p.components.map((c) => ({
    componentId: c.componentId,
    name: c.component.name,
    unit: c.component.unit,
    quantity: c.quantity,
    unitCost: c.component.cost
  }));
  return {
    id: p.id,
    name: p.name,
    type: p.type as ProductType,
    unit: p.unit,
    price: p.price,
    cost: p.composed ? round2(components.reduce((t, c) => t + c.quantity * c.unitCost, 0)) : p.cost,
    stock: p.stock,
    ncm: p.ncm,
    cst: p.cst,
    taxRate: p.taxRate,
    composed: p.composed,
    components,
    unitLocked: (p._count?.movements ?? 0) > 0
  };
}

export function serializeMovement(m: StockMovement & { product: Product }): ApiStockMovement {
  return {
    id: m.id,
    productName: m.product.name,
    unit: m.product.unit,
    kind: m.kind as ApiStockMovement["kind"],
    quantity: m.quantity,
    source: m.source,
    createdAt: m.createdAt.toISOString()
  };
}

export function serializeFinanceEntry(e: FinanceEntry): ApiFinanceEntry {
  return {
    id: e.id,
    kind: e.kind as ApiFinanceEntry["kind"],
    description: e.description,
    amount: e.amount,
    dueDate: e.dueDate,
    status: e.status as ApiFinanceEntry["status"],
    category: e.category,
    costCenter: e.costCenter,
    paidOn: e.paidOn,
    paymentMethod: e.paymentMethod
  };
}
