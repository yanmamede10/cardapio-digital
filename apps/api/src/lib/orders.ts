import { Prisma } from "@prisma/client";
import type { CreateOrderRequest } from "@cardapio/shared";
import { prisma } from "../db.js";
import { generateOrderCode } from "./codes.js";
import { evaluateCoupon } from "./coupons.js";
import { priceLine, round2 } from "./pricing.js";

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
  const pricedLines: { itemId: string; name: string; unitPrice: number; quantity: number; notes: string; selectedOptionsJson: string }[] = [];
  try {
    for (const line of body.lines) {
      const item = await prisma.menuItem.findUnique({ where: { id: line.itemId } });
      if (!item || item.restaurantId !== body.restaurantId) return { status: 400, error: `unknown item ${line.itemId}` };
      if (item.soldOut) return { status: 400, error: `${item.name} está esgotado` };
      const { unitPrice, selectedOptions } = priceLine(item, (line.selectedOptions || []).map((o) => ({ groupId: o.groupId, optionId: o.optionId })));
      pricedLines.push({
        itemId: item.id,
        name: item.name,
        unitPrice,
        quantity: Math.max(1, Math.floor(line.quantity || 1)),
        notes: line.notes || "",
        selectedOptionsJson: JSON.stringify(selectedOptions)
      });
    }
  } catch (err) {
    return { status: 400, error: err instanceof Error ? err.message : "invalid line options" };
  }

  const subtotal = round2(pricedLines.reduce((t, l) => t + l.unitPrice * l.quantity, 0));
  const deliveryFee = mode === "delivery" ? restaurant.deliveryFee : 0;
  const coupon = mode === "delivery" ? evaluateCoupon(body.couponCode) : { valid: false, discountPercent: 0, message: "" };
  const discount = coupon.valid ? round2(subtotal * (coupon.discountPercent / 100)) : 0;

  let round = 1;
  if (mode === "table" && body.tableNumber) {
    // First order of a seating stamps openedAt ("aberta às"); the comanda itself is the table's orders with no closedAt.
    const where = { restaurantId: body.restaurantId, number: body.tableNumber };
    const { count } = await prisma.restaurantTable.updateMany({ where: { ...where, openedAt: null }, data: { openedAt: new Date() } });
    if (!count && !(await prisma.restaurantTable.findUnique({ where: { restaurantId_number: where } }))) {
      // Unknown number (not from a QR): the table is created. Two first orders at once → the loser finds it created.
      await prisma.restaurantTable.create({ data: { ...where, seats: 4, openedAt: new Date() } }).catch((err) => {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      });
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    round = 1 + (await prisma.order.count({ where: { mode: "table", restaurantId: body.restaurantId, tableNumber: body.tableNumber, guestSessionId, createdAt: { gte: startOfDay } } }));
  }

  const order = await prisma.order.create({
    data: {
      code: generateOrderCode(),
      mode,
      restaurantId: body.restaurantId,
      restaurantName: restaurant.name,
      tableNumber: mode === "table" ? body.tableNumber ?? null : null,
      guestName: body.guestName || null,
      guestSessionId,
      waiterName,
      addressId: mode === "delivery" ? body.addressId ?? null : null,
      paymentMethodId: mode === "delivery" ? body.paymentMethodId ?? null : null,
      couponCode: coupon.valid ? body.couponCode ?? null : null,
      subtotal,
      deliveryFee,
      discount,
      total: round2(subtotal + deliveryFee - discount),
      // Taken at the table by the waiter: no one needs to accept it, it goes straight into production.
      status: waiterName ? "preparing" : "pending",
      round,
      lines: { create: pricedLines }
    },
    include: { lines: true }
  });
  return { order };
}
