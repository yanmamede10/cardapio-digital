import { Router, type Request } from "express";
import type { CreateOrderRequest, OrderStatus } from "@cardapio/shared";
import { prisma } from "../db.js";
import { generateOrderCode } from "../lib/codes.js";
import { evaluateCoupon } from "../lib/coupons.js";
import { priceLine, round2 } from "../lib/pricing.js";
import { serializeOrder } from "../lib/serialize.js";

const VALID_STAGES: OrderStatus[] = ["preparing", "ready", "out_for_delivery", "delivered", "served", "cancelled"];

export const ordersRouter = Router();

function sessionId(req: Request): string {
  const raw = req.header("X-Session-Id");
  return raw && raw.trim() ? raw.trim() : "anonymous";
}

ordersRouter.post("/", async (req, res) => {
  const body = req.body as CreateOrderRequest;
  if (!body || !body.restaurantId || !Array.isArray(body.lines) || body.lines.length === 0) {
    return res.status(400).json({ error: "restaurantId and at least one line are required" });
  }
  const restaurant = await prisma.restaurant.findUnique({ where: { id: body.restaurantId } });
  if (!restaurant) return res.status(404).json({ error: "restaurant not found" });

  const mode = body.mode === "delivery" ? "delivery" : "table";
  const guestSessionId = sessionId(req);

  const pricedLines: {
    itemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    notes: string;
    selectedOptionsJson: string;
  }[] = [];

  try {
    for (const line of body.lines) {
      const item = await prisma.menuItem.findUnique({ where: { id: line.itemId } });
      if (!item || item.restaurantId !== body.restaurantId) {
        return res.status(400).json({ error: `unknown item ${line.itemId}` });
      }
      if (item.soldOut) {
        return res.status(400).json({ error: `${item.name} está esgotado` });
      }
      const qty = Math.max(1, Math.floor(line.quantity || 1));
      const { unitPrice, selectedOptions } = priceLine(
        item,
        (line.selectedOptions || []).map((o) => ({ groupId: o.groupId, optionId: o.optionId }))
      );
      pricedLines.push({
        itemId: item.id,
        name: item.name,
        unitPrice,
        quantity: qty,
        notes: line.notes || "",
        selectedOptionsJson: JSON.stringify(selectedOptions)
      });
    }
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "invalid line options" });
  }

  const subtotal = round2(pricedLines.reduce((t, l) => t + l.unitPrice * l.quantity, 0));
  const deliveryFee = mode === "delivery" ? restaurant.deliveryFee : 0;
  const coupon = mode === "delivery" ? evaluateCoupon(body.couponCode) : { valid: false, discountPercent: 0, message: "" };
  const discount = coupon.valid ? round2(subtotal * (coupon.discountPercent / 100)) : 0;
  const total = round2(subtotal + deliveryFee - discount);

  let round = 1;
  if (mode === "table" && body.tableNumber) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    round =
      1 +
      (await prisma.order.count({
        where: {
          mode: "table",
          restaurantId: body.restaurantId,
          tableNumber: body.tableNumber,
          guestSessionId,
          createdAt: { gte: startOfDay }
        }
      }));
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
      addressId: mode === "delivery" ? body.addressId ?? null : null,
      paymentMethodId: mode === "delivery" ? body.paymentMethodId ?? null : null,
      couponCode: coupon.valid ? body.couponCode ?? null : null,
      subtotal,
      deliveryFee,
      discount,
      total,
      status: "pending",
      round,
      lines: { create: pricedLines }
    },
    include: { lines: true }
  });

  if (mode === "table" && body.tableNumber) {
    const table = await prisma.restaurantTable.findUnique({
      where: { restaurantId_number: { restaurantId: body.restaurantId, number: body.tableNumber } }
    });
    if (table) {
      if (!table.openedAt) await prisma.restaurantTable.update({ where: { id: table.id }, data: { openedAt: new Date() } });
    } else {
      await prisma.restaurantTable.create({
        data: { restaurantId: body.restaurantId, number: body.tableNumber, seats: 4, openedAt: new Date() }
      });
    }
  }

  res.status(201).json(serializeOrder(order));
});

ordersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { lines: true } });
  if (!order) return res.status(404).json({ error: "order not found" });
  res.json(serializeOrder(order));
});

ordersRouter.get("/", async (req, res) => {
  const { mode } = req.query as { mode?: string };
  const guestSessionId = sessionId(req);
  const orders = await prisma.order.findMany({
    where: { guestSessionId, ...(mode ? { mode } : {}) },
    include: { lines: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(orders.map(serializeOrder));
});

ordersRouter.post("/:id/call-waiter", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "order not found" });
  await prisma.order.update({ where: { id: order.id }, data: { waiterCalledAt: new Date() } });
  if (order.mode === "table" && order.tableNumber) {
    await prisma.waiterCall.create({
      data: { restaurantId: order.restaurantId, tableNumber: order.tableNumber, reason: "Chamado pelo cliente" }
    });
  }
  res.json({ ok: true });
});

ordersRouter.post("/:id/repeat", async (req, res) => {
  const original = await prisma.order.findUnique({ where: { id: req.params.id }, include: { lines: true } });
  if (!original) return res.status(404).json({ error: "order not found" });
  const guestSessionId = sessionId(req);

  const pricedLines: {
    itemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    notes: string;
    selectedOptionsJson: string;
  }[] = [];

  for (const line of original.lines) {
    const item = await prisma.menuItem.findUnique({ where: { id: line.itemId } });
    if (!item || item.soldOut) continue;
    const options = JSON.parse(line.selectedOptionsJson) as { groupId: string; optionId: string }[];
    const { unitPrice, selectedOptions } = priceLine(item, options);
    pricedLines.push({
      itemId: item.id,
      name: item.name,
      unitPrice,
      quantity: line.quantity,
      notes: line.notes,
      selectedOptionsJson: JSON.stringify(selectedOptions)
    });
  }
  if (pricedLines.length === 0) {
    return res.status(400).json({ error: "nenhum item deste pedido está disponível agora" });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: original.restaurantId } });
  const subtotal = round2(pricedLines.reduce((t, l) => t + l.unitPrice * l.quantity, 0));
  const deliveryFee = original.mode === "delivery" ? restaurant?.deliveryFee ?? 0 : 0;
  const total = round2(subtotal + deliveryFee);

  const order = await prisma.order.create({
    data: {
      code: generateOrderCode(),
      mode: original.mode,
      restaurantId: original.restaurantId,
      restaurantName: original.restaurantName,
      tableNumber: original.tableNumber,
      guestName: original.guestName,
      guestSessionId,
      addressId: original.addressId,
      paymentMethodId: original.paymentMethodId,
      couponCode: null,
      subtotal,
      deliveryFee,
      discount: 0,
      total,
      status: "pending",
      round: 1,
      lines: { create: pricedLines }
    },
    include: { lines: true }
  });

  res.status(201).json(serializeOrder(order));
});

ordersRouter.post("/:id/accept", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.status !== "pending") return res.status(409).json({ error: "order is not pending" });
  const updated = await prisma.order.update({ where: { id: order.id }, data: { status: "preparing" }, include: { lines: true } });
  res.json(serializeOrder(updated));
});

ordersRouter.post("/:id/reject", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.status !== "pending") return res.status(409).json({ error: "order is not pending" });
  await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
  res.json({ ok: true });
});

ordersRouter.patch("/:id/stage", async (req, res) => {
  const { stage } = req.body as { stage?: OrderStatus };
  if (!stage || !VALID_STAGES.includes(stage)) return res.status(400).json({ error: "invalid stage" });
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "order not found" });
  const updated = await prisma.order.update({ where: { id: order.id }, data: { status: stage }, include: { lines: true } });
  res.json(serializeOrder(updated));
});
