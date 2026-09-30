import { type Request } from "express";
import { asyncRouter } from "../lib/router.js";
import type { CreateOrderRequest, OrderStatus } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireModule, requireStaff } from "../lib/auth.js";
import { placeOrder } from "../lib/orders.js";
import { serializeOrder } from "../lib/serialize.js";
import { takeStockForOrders } from "../lib/stock.js";

const VALID_STAGES: OrderStatus[] = ["preparing", "ready", "out_for_delivery", "delivered", "served", "cancelled"];

export const ordersRouter = asyncRouter();

function sessionId(req: Request): string {
  const raw = req.header("X-Session-Id");
  return raw && raw.trim() ? raw.trim() : "anonymous";
}

ordersRouter.post("/", async (req, res) => {
  const placed = await placeOrder(req.body as CreateOrderRequest, sessionId(req));
  if ("error" in placed) return res.status(placed.status).json({ error: placed.error });
  res.status(201).json(serializeOrder(placed.order));
});

// Customer-only (polled by the guest's own status screen) — no staff caller exists for this
// route today (dashboard reads orders via GET /api/restaurants/:id/orders, staff-guarded).
// 404 rather than 403 on a mismatch so an outsider can't even confirm the id exists.
ordersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { lines: true } });
  if (!order || order.guestSessionId !== sessionId(req)) return res.status(404).json({ error: "order not found" });
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

ordersRouter.post("/:id/accept", requireStaff, requireModule("pedidos"), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.restaurantId !== req.staff!.restaurantId) return res.status(403).json({ error: "forbidden: restaurant mismatch" });
  // Conditional: of two devices accepting/refusing the same order at once, exactly one wins (the other gets 409).
  const { count } = await prisma.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "preparing" } });
  if (!count) return res.status(409).json({ error: "order is not pending" });
  res.json(serializeOrder(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true } })));
});

ordersRouter.post("/:id/reject", requireStaff, requireModule("pedidos"), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.restaurantId !== req.staff!.restaurantId) return res.status(403).json({ error: "forbidden: restaurant mismatch" });
  const { count } = await prisma.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "cancelled" } }); // see accept
  if (!count) return res.status(409).json({ error: "order is not pending" });
  res.json({ ok: true });
});

ordersRouter.patch("/:id/stage", requireStaff, requireModule("pedidos"), async (req, res) => {
  const { stage } = req.body as { stage?: OrderStatus };
  if (!stage || !VALID_STAGES.includes(stage)) return res.status(400).json({ error: "invalid stage" });
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "order not found" });
  if (order.restaurantId !== req.staff!.restaurantId) return res.status(403).json({ error: "forbidden: restaurant mismatch" });
  // A delivery closes when delivered (table orders take stock on comanda close instead). The
  // conditional updateMany claims that transition once, so a double click can't take stock twice.
  const delivering =
    order.mode === "delivery" &&
    stage === "delivered" &&
    (await prisma.order.updateMany({ where: { id: order.id, status: { not: "delivered" } }, data: { status: "delivered" } })).count > 0;
  const updated = await prisma.order.update({ where: { id: order.id }, data: { status: stage }, include: { lines: true } });
  if (delivering) await takeStockForOrders(order.restaurantId, [updated], `Pedido delivery ${order.code}`);
  res.json(serializeOrder(updated));
});
