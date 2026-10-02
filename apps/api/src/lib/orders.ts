import { Prisma } from "@prisma/client";
import type { CreateOrderRequest } from "@cardapio/shared";
import { prisma } from "../db.js";
import { generateOrderCode } from "./codes.js";
import { evaluateCoupon } from "./coupons.js";
import { PricingError, priceLine, round2 } from "./pricing.js";
import { recipeOf } from "./stock.js";
import { hasOpenComanda } from "./tables.js";

const MAX_NOTES_LENGTH = 300;
const MAX_GUEST_NAME_LENGTH = 120;

type Placed = { order: Prisma.OrderGetPayload<{ include: { lines: true } }> } | { status: number; error: string };

/** One way into the kitchen for every order: the customer's (QR, tablet, delivery) and the waiter's (Lançar pedido).
 *  Prices are re-derived from the menu, sold-out dishes refused, and a table's first order opens it. */
export async function placeOrder(body: CreateOrderRequest, guestSessionId: string, waiterName: string | null = null): Promise<Placed> {
  if (!body || !body.restaurantId || !Array.isArray(body.lines) || body.lines.length === 0) {
    return { status: 400, error: "restaurantId and at least one line are required" };
  }
  if (body.guestName && body.guestName.length > MAX_GUEST_NAME_LENGTH) return { status: 400, error: `guestName must be at most ${MAX_GUEST_NAME_LENGTH} characters` };
  if (body.lines.some((line) => (line.notes?.length ?? 0) > MAX_NOTES_LENGTH)) return { status: 400, error: `notes must be at most ${MAX_NOTES_LENGTH} characters` };
  const restaurant = await prisma.restaurant.findUnique({ where: { id: body.restaurantId } });
  if (!restaurant) return { status: 404, error: "restaurant not found" };

  const mode = body.mode === "delivery" ? "delivery" : "table";
  // Delivery: only an active restaurant takes orders (pending and deactivated ones aren't listed either). A table order is
  // checked with its table below; the waiter's, by requireStaff.
  if (mode === "delivery" && restaurant.status !== "ativo") return { status: 404, error: "restaurant not found" };
  if (mode === "table" && !waiterName && !restaurant.qrOrdering) return { status: 403, error: "Neste restaurante os pedidos da mesa são feitos pelo garçom." };
  let tableNumber: number | null = null;
  if (mode === "table" && waiterName) tableNumber = body.tableNumber ?? null; // the route already found the table
  else if (mode === "table") {
    // A customer orders for the table whose QR (or fixed tablet) they hold — its random code, never a number anyone could type.
    const table = body.tableCode ? await prisma.restaurantTable.findUnique({ where: { qrCode: body.tableCode } }) : null;
    if (!table || table.restaurantId !== restaurant.id || restaurant.status !== "ativo") return { status: 404, error: "Mesa não encontrada. Leia o QR da mesa de novo ou chame um atendente." };
    tableNumber = table.number;
  }
  const pricedLines: { itemId: string; name: string; unitPrice: number; quantity: number; notes: string; selectedOptionsJson: string; stockJson: string }[] = [];
  try {
    for (const line of body.lines) {
      // A string, or Prisma would answer with its own error (source path and query) instead of "unknown item".
      const item = typeof line.itemId === "string" ? await prisma.menuItem.findUnique({ where: { id: line.itemId }, include: { product: { include: { components: true } } } }) : null;
      if (!item || item.restaurantId !== body.restaurantId) return { status: 400, error: `unknown item ${line.itemId}` };
      if (item.soldOut) return { status: 400, error: `${item.name} está esgotado` };
      const { unitPrice, selectedOptions } = priceLine(item, (line.selectedOptions || []).map((o) => ({ groupId: o.groupId, optionId: o.optionId })));
      pricedLines.push({
        itemId: item.id,
        name: item.name,
        unitPrice,
        quantity: Math.max(1, Math.floor(line.quantity || 1)),
        notes: line.notes || "",
        selectedOptionsJson: JSON.stringify(selectedOptions),
        // The ficha técnica as sold: closing the comanda takes this even if the recipe changes or the dish leaves the Cardápio.
        stockJson: JSON.stringify(recipeOf(item.product?.restaurantId === body.restaurantId ? item.product : null))
      });
    }
  } catch (err) {
    if (!(err instanceof PricingError)) throw err; // anything else is ours: a plain 500, never its message
    return { status: 400, error: err.message };
  }

  const subtotal = round2(pricedLines.reduce((t, l) => t + l.unitPrice * l.quantity, 0));
  const deliveryFee = mode === "delivery" ? restaurant.deliveryFee : 0;
  const coupon = mode === "delivery" ? evaluateCoupon(body.couponCode) : { valid: false, discountPercent: 0, message: "" };
  const discount = coupon.valid ? round2(subtotal * (coupon.discountPercent / 100)) : 0;

  let round = 1;
  // Taken at the table by the waiter: no one needs to accept it, it goes straight into production.
  let status = waiterName ? "preparing" : "pending";
  if (tableNumber !== null) {
    // A customer's order at a free table (no comanda open) waits in the Central until someone accepts it: until then it
    // doesn't open the table, take stock or count anywhere — a QR read by someone who isn't there opens nothing.
    if (!waiterName && !(await hasOpenComanda(body.restaurantId, tableNumber))) status = "awaiting";
    // Otherwise the first order of a seating stamps openedAt ("aberta às"); the comanda is the table's orders with no closedAt.
    else await prisma.restaurantTable.updateMany({ where: { restaurantId: body.restaurantId, number: tableNumber, openedAt: null }, data: { openedAt: new Date() } });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    round = 1 + (await prisma.order.count({ where: { mode: "table", restaurantId: body.restaurantId, tableNumber, guestSessionId, createdAt: { gte: startOfDay } } }));
  }

  const order = await prisma.order.create({
    data: {
      code: generateOrderCode(),
      mode,
      restaurantId: body.restaurantId,
      restaurantName: restaurant.name,
      tableNumber,
      guestName: body.guestName || null,
      guestSessionId,
      waiterName,
      // "Para levar" exists only at the end of a customer's table order (QR or tablet).
      takeaway: mode === "table" && !waiterName && body.takeaway === true,
      addressId: mode === "delivery" ? body.addressId ?? null : null,
      paymentMethodId: mode === "delivery" ? body.paymentMethodId ?? null : null,
      couponCode: coupon.valid ? body.couponCode ?? null : null,
      subtotal,
      deliveryFee,
      discount,
      total: round2(subtotal + deliveryFee - discount),
      status,
      round,
      lines: { create: pricedLines }
    },
    include: { lines: true }
  });
  return { order };
}
