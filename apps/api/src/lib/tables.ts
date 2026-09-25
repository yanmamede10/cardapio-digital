import type { TableComanda, TableStatus } from "@cardapio/shared";
import type { Order, OrderLine, RestaurantTable } from "@prisma/client";
import { prisma } from "../db.js";
import { round2 } from "./pricing.js";

const SERVICE_PCT = 10;

/** Service charged on one order (table only). Per order, so the comanda's service is exactly the sum
 *  of what the Emissão Fiscal queue adds to each of its orders. */
export const serviceFee = (o: Pick<Order, "mode" | "subtotal">) => (o.mode === "table" ? round2(o.subtotal * (SERVICE_PCT / 100)) : 0);

/**
 * A table's comanda is every non-cancelled order for that number placed since
 * it was last opened — `openedAt` is cleared on close, so a fresh seating
 * never sees the previous guest's paid orders.
 */
export async function openOrdersForTable(restaurantId: string, table: RestaurantTable): Promise<(Order & { lines: OrderLine[] })[]> {
  if (!table.openedAt) return [];
  return prisma.order.findMany({
    where: {
      restaurantId,
      mode: "table",
      tableNumber: table.number,
      createdAt: { gte: table.openedAt },
      status: { not: "cancelled" }
    },
    include: { lines: true },
    orderBy: { createdAt: "asc" }
  });
}

export function statusForTable(table: RestaurantTable, openOrders: Order[]): TableStatus {
  if (!table.openedAt || openOrders.length === 0) return "free";
  const allServed = openOrders.every((o) => o.status === "served");
  return allServed ? "awaiting_payment" : "occupied";
}

export function buildComanda(table: RestaurantTable, orders: (Order & { lines: OrderLine[] })[]): TableComanda {
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
  const service = round2(orders.reduce((t, o) => t + serviceFee(o), 0));
  return {
    table: {
      id: table.id,
      restaurantId: table.restaurantId,
      number: table.number,
      seats: table.seats,
      status: statusForTable(table, orders),
      openedAt: table.openedAt ? table.openedAt.toISOString() : null,
      gridRow: table.gridRow ?? null,
      gridCol: table.gridCol ?? null
    },
    orderIds: orders.map((o) => o.id),
    lines,
    subtotal,
    servicePct: SERVICE_PCT,
    service,
    total: round2(subtotal + service)
  };
}
