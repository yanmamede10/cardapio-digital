import type { AnalyticsHeatRow, AnalyticsItemStat, AnalyticsKpis, AnalyticsPeriod, AnalyticsRevenuePoint, AnalyticsSummary } from "@cardapio/shared";
import type { Order, OrderLine } from "@prisma/client";
import { prisma } from "../db.js";
import { round2 } from "./pricing.js";

type OrderWithLines = Order & { lines: OrderLine[] };

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function rangeFor(period: AnalyticsPeriod, now = new Date()): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const to = new Date(now);
  if (period === "week") {
    const from = startOfDay(new Date(now));
    from.setDate(from.getDate() - 6);
    const prevTo = new Date(from);
    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - 7);
    return { from, to, prevFrom, prevTo };
  }
  if (period === "month" || period === "custom") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to, prevFrom, prevTo };
  }
  // today
  const from = startOfDay(now);
  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - 1);
  const prevTo = new Date(from);
  return { from, to, prevFrom, prevTo };
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return round2(((current - previous) / previous) * 100);
}

async function ordersBetween(restaurantId: string, from: Date, to: Date): Promise<OrderWithLines[]> {
  return prisma.order.findMany({
    // A free table's first order still awaiting acceptance isn't a sale yet (nor a cancellation).
    where: { restaurantId, createdAt: { gte: from, lt: to }, status: { not: "awaiting" } },
    include: { lines: true }
  });
}

function kpisFor(orders: OrderWithLines[]): AnalyticsKpis {
  const live = orders.filter((o) => o.status !== "cancelled");
  const revenue = round2(live.reduce((t, o) => t + o.total, 0));
  // The table service apart from the products: what was frozen on each order when its comanda closed (Order.service),
  // never today's setting. Products + service = what was charged, the same as Contas a Receber.
  const service = round2(live.reduce((t, o) => t + o.service, 0));
  const orderCount = live.length;
  const cancellations = orders.filter((o) => o.status === "cancelled").length;
  return {
    revenue,
    service,
    total: round2(revenue + service),
    revenueDeltaPct: 0,
    avgTicket: orderCount ? round2(revenue / orderCount) : 0,
    avgTicketDeltaPct: 0,
    orderCount,
    orderCountDeltaPct: 0,
    tableOrders: live.filter((o) => o.mode === "table").length,
    deliveryOrders: live.filter((o) => o.mode === "delivery").length,
    cancellations,
    cancellationsDeltaPct: 0,
    cancellationRatePct: orders.length ? round2((cancellations / orders.length) * 100) : 0
  };
}

function revenueSeriesFor(period: AnalyticsPeriod, orders: OrderWithLines[], from: Date, to: Date): AnalyticsRevenuePoint[] {
  const live = orders.filter((o) => o.status !== "cancelled");
  if (period === "today") {
    const buckets = new Map<number, { tableRevenue: number; deliveryRevenue: number }>();
    for (let h = 0; h < 24; h++) buckets.set(h, { tableRevenue: 0, deliveryRevenue: 0 });
    for (const o of live) {
      const h = o.createdAt.getHours();
      const b = buckets.get(h)!;
      if (o.mode === "table") b.tableRevenue += o.total;
      else b.deliveryRevenue += o.total;
    }
    return Array.from(buckets.entries())
      .filter(([h]) => h >= 8 && h <= 23)
      .map(([h, b]) => ({ label: `${String(h).padStart(2, "0")}h`, tableRevenue: round2(b.tableRevenue), deliveryRevenue: round2(b.deliveryRevenue) }));
  }

  const days: { key: string; label: string }[] = [];
  const cursor = new Date(from);
  while (cursor < to) {
    days.push({ key: cursor.toDateString(), label: cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) });
    cursor.setDate(cursor.getDate() + 1);
  }
  const byDay = new Map(days.map((d) => [d.key, { tableRevenue: 0, deliveryRevenue: 0 }]));
  for (const o of live) {
    const key = o.createdAt.toDateString();
    const b = byDay.get(key);
    if (!b) continue;
    if (o.mode === "table") b.tableRevenue += o.total;
    else b.deliveryRevenue += o.total;
  }
  return days.map((d) => ({ label: d.label, tableRevenue: round2(byDay.get(d.key)!.tableRevenue), deliveryRevenue: round2(byDay.get(d.key)!.deliveryRevenue) }));
}

function itemStatsFor(orders: OrderWithLines[]): AnalyticsItemStat[] {
  const live = orders.filter((o) => o.status !== "cancelled");
  const byItem = new Map<string, AnalyticsItemStat>();
  for (const o of live) {
    for (const l of o.lines) {
      const cur = byItem.get(l.itemId) || { itemId: l.itemId, name: l.name, quantity: 0, revenue: 0 };
      cur.quantity += l.quantity;
      cur.revenue = round2(cur.revenue + l.unitPrice * l.quantity);
      byItem.set(l.itemId, cur);
    }
  }
  return Array.from(byItem.values());
}

const HEAT_BANDS = [
  { label: "11h", start: 11, end: 13 },
  { label: "13h", start: 13, end: 15 },
  { label: "18h", start: 18, end: 20 },
  { label: "20h", start: 20, end: 22 },
  { label: "22h", start: 22, end: 24 }
];
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function heatmapFor(orders: OrderWithLines[]): AnalyticsHeatRow[] {
  const live = orders.filter((o) => o.status !== "cancelled");
  const counts = WEEKDAY_LABELS.map(() => HEAT_BANDS.map(() => 0));
  for (const o of live) {
    const jsDay = o.createdAt.getDay(); // 0=Sun..6=Sat
    const weekday = (jsDay + 6) % 7; // 0=Mon..6=Sun
    const hour = o.createdAt.getHours();
    const bandIndex = HEAT_BANDS.findIndex((b) => hour >= b.start && hour < b.end);
    if (bandIndex >= 0) counts[weekday][bandIndex] += 1;
  }
  const max = Math.max(1, ...counts.flat());
  return WEEKDAY_LABELS.map((dayLabel, di) => ({
    dayLabel,
    cells: HEAT_BANDS.map((b, bi) => ({ hourLabel: b.label, orderCount: counts[di][bi], intensity: round2(counts[di][bi] / max) }))
  }));
}

export async function buildAnalytics(restaurantId: string, period: AnalyticsPeriod): Promise<AnalyticsSummary> {
  const { from, to, prevFrom, prevTo } = rangeFor(period);
  const [orders, prevOrders, reviews] = await Promise.all([
    ordersBetween(restaurantId, from, to),
    ordersBetween(restaurantId, prevFrom, prevTo),
    prisma.review.findMany({ where: { restaurantId } })
  ]);

  const kpis = kpisFor(orders);
  const prevKpis = kpisFor(prevOrders);
  kpis.revenueDeltaPct = deltaPct(kpis.revenue, prevKpis.revenue);
  kpis.avgTicketDeltaPct = deltaPct(kpis.avgTicket, prevKpis.avgTicket);
  kpis.orderCountDeltaPct = deltaPct(kpis.orderCount, prevKpis.orderCount);
  kpis.cancellationsDeltaPct = deltaPct(kpis.cancellations, prevKpis.cancellations);

  const itemStats = itemStatsFor(orders).sort((a, b) => b.quantity - a.quantity);
  const topSellers = itemStats.slice(0, 5);
  const bottomSellers = itemStats.slice(-5).reverse();

  const reviewCount = reviews.length;
  const reviewAverage = reviewCount ? round2(reviews.reduce((t, r) => t + r.rating, 0) / reviewCount) : 0;

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    kpis,
    revenueSeries: revenueSeriesFor(period, orders, from, to),
    topSellers,
    bottomSellers,
    heatmap: heatmapFor(orders),
    reviewAverage,
    reviewCount
  };
}

export async function buildShiftStats(restaurantId: string) {
  const today = startOfDay(new Date());
  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: today }, status: { in: ["delivered", "served"] } }
  });
  const closedOrders = orders.length;
  const shiftRevenue = round2(orders.reduce((t, o) => t + o.total, 0));
  const shiftService = round2(orders.reduce((t, o) => t + o.service, 0)); // frozen at the close, as in the reports
  const avgTicket = closedOrders ? round2(shiftRevenue / closedOrders) : 0;
  const avgPrepMinutes = closedOrders
    ? Math.round(orders.reduce((t, o) => t + (o.updatedAt.getTime() - o.createdAt.getTime()) / 60000, 0) / closedOrders)
    : 0;
  return { closedOrders, avgTicket, avgPrepMinutes, shiftRevenue, shiftService, shiftTotal: round2(shiftRevenue + shiftService) };
}
