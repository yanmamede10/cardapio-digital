import type { TableComanda, TableStatus } from "@cardapio/shared";
import type { Order, OrderLine, RestaurantTable } from "@prisma/client";
import { prisma } from "../db.js";
import { round2 } from "./pricing.js";

/** The table's service: 10% when the restaurant charges it (Restaurant.serviceCharge), else 0. */
export const servicePct = (r: { serviceCharge: boolean } | null) => (r?.serviceCharge === false ? 0 : 10);

/** Service on one order (table only). Per order, so the comanda's service is exactly the sum of what closing
 *  freezes on each of its orders (Order.service, which Emissão Fiscal reads). */
export const serviceFee = (o: Pick<Order, "mode" | "subtotal">, pct: number) => (o.mode === "table" ? round2(o.subtotal * (pct / 100)) : 0);

/** A table's open comanda: its non-cancelled orders not closed yet (closing stamps closedAt on exactly the orders it charged). */
const openWhere = (restaurantId: string) => ({ restaurantId, mode: "table", closedAt: null, status: { not: "cancelled" } });

export function openOrdersForTable(restaurantId: string, number: number): Promise<(Order & { lines: OrderLine[] })[]> {
  return prisma.order.findMany({ where: { ...openWhere(restaurantId), tableNumber: number }, include: { lines: true }, orderBy: { createdAt: "asc" } });
}

/** Every table's open orders in one query (salon map, table list). */
export async function openOrdersByTable(restaurantId: string): Promise<Map<number, Order[]>> {
  const byTable = new Map<number, Order[]>();
  for (const o of await prisma.order.findMany({ where: openWhere(restaurantId) })) byTable.set(o.tableNumber!, [...(byTable.get(o.tableNumber!) ?? []), o]);
  return byTable;
}

export function statusForTable(openOrders: Order[] = []): TableStatus {
  if (openOrders.length === 0) return "free";
  return openOrders.every((o) => o.status === "served") ? "awaiting_payment" : "occupied";
}

export function buildComanda(table: RestaurantTable, orders: (Order & { lines: OrderLine[] })[], pct: number): TableComanda {
  const lines = orders.flatMap((o) =>
    o.lines.map((l) => ({
      orderId: o.id,
      itemId: l.itemId,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subtotal: round2(l.unitPrice * l.quantity)
    }))
  );
  const subtotal = round2(lines.reduce((t, l) => t + l.subtotal, 0));
  const service = round2(orders.reduce((t, o) => t + serviceFee(o, pct), 0));
  return {
    table: {
      id: table.id,
      restaurantId: table.restaurantId,
      number: table.number,
      seats: table.seats,
      status: statusForTable(orders),
      openedAt: table.openedAt ? table.openedAt.toISOString() : null,
      gridRow: table.gridRow ?? null,
      gridCol: table.gridCol ?? null
    },
    orderIds: orders.map((o) => o.id),
    lines,
    subtotal,
    servicePct: pct,
    service,
    total: round2(subtotal + service)
  };
}
