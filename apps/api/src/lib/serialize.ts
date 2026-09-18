import type {
  Address as ApiAddress,
  AppearanceState,
  CartLine,
  Coupon as ApiCoupon,
  FiscalInfo,
  MenuItem as ApiMenuItem,
  MenuItemOptionGroup,
  MenuTemplateId,
  Order as ApiOrder,
  OperatingHoursRow,
  PaymentMethod as ApiPaymentMethod,
  PublicAppearance,
  Restaurant as ApiRestaurant,
  RestaurantProfile,
  RestaurantTable as ApiRestaurantTable,
  Review as ApiReview,
  StaffMember as ApiStaffMember,
  SupportMessage as ApiSupportMessage,
  SupportTicket as ApiSupportTicket,
  TableStatus,
  WaiterCall as ApiWaiterCall
} from "@cardapio/shared";
import type {
  Address,
  BillingCharge,
  Coupon,
  MenuItem,
  OperatingHour,
  Order,
  OrderLine,
  PaymentMethod,
  Restaurant,
  RestaurantTable,
  Review,
  StaffMember,
  SupportMessage,
  SupportTicket,
  WaiterCall
} from "@prisma/client";

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
    tag: item.tag,
    tagIcon: item.tagIcon,
    soldOut: item.soldOut,
    sortOrder: item.sortOrder,
    scheduleLabel: item.scheduleLabel,
    optionGroups: JSON.parse(item.optionGroupsJson) as MenuItemOptionGroup[]
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
    createdAt: order.createdAt.toISOString()
  };
}

export function serializeTable(t: RestaurantTable, status: TableStatus): ApiRestaurantTable {
  return {
    id: t.id,
    restaurantId: t.restaurantId,
    number: t.number,
    seats: t.seats,
    status,
    openedAt: t.openedAt ? t.openedAt.toISOString() : null
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

export function serializeTicket(t: SupportTicket & { messages: SupportMessage[] }): ApiSupportTicket {
  return {
    id: t.id,
    restaurantId: t.restaurantId,
    channel: t.channel as ApiSupportTicket["channel"],
    customerName: t.customerName,
    refLabel: t.refLabel,
    status: t.status as ApiSupportTicket["status"],
    assignee: t.assignee,
    unreadCount: t.unreadCount,
    messages: t.messages.map(serializeMessage),
    createdAt: t.createdAt.toISOString(),
    lastActivityAt: t.lastActivityAt.toISOString()
  };
}

export function serializeMessage(m: SupportMessage): ApiSupportMessage {
  return {
    id: m.id,
    from: m.from as ApiSupportMessage["from"],
    authorName: m.authorName,
    text: m.text,
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
    taxRegime: r.taxRegime,
    fiscalAddress: r.fiscalAddress
  };
}

export function serializeCharge(c: BillingCharge): { id: string; restaurantId: string; date: string; description: string; value: number; status: "paid" | "pending" | "failed" } {
  return {
    id: c.id,
    restaurantId: c.restaurantId,
    date: c.date.toISOString(),
    description: c.description,
    value: c.value,
    status: c.status as "paid" | "pending" | "failed"
  };
}
