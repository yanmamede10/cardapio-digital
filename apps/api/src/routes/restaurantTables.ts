import { Router } from "express";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireStaff } from "../lib/auth.js";
import { buildComanda, openOrdersForTable, statusForTable } from "../lib/tables.js";
import { serializeTable, serializeWaiterCall } from "../lib/serialize.js";

export const restaurantTablesRouter = Router();
// Applied per-route (not via router.use) because several routers share the
// "/api/restaurants" mount point — a path-based router.use() here would also
// run for sibling routers' routes (e.g. reports' /:id/shift-stats).
const staffGuard = [requireStaff, requireOwnRestaurant];

async function findTable(restaurantId: string, number: number) {
  return prisma.restaurantTable.findUnique({ where: { restaurantId_number: { restaurantId, number } } });
}

restaurantTablesRouter.get("/:id/tables", ...staffGuard, async (req, res) => {
  const tables = await prisma.restaurantTable.findMany({ where: { restaurantId: req.params.id }, orderBy: { number: "asc" } });
  const withStatus = await Promise.all(
    tables.map(async (t) => serializeTable(t, statusForTable(t, await openOrdersForTable(req.params.id, t))))
  );
  res.json(withStatus);
});

restaurantTablesRouter.post("/:id/tables", ...staffGuard, async (req, res) => {
  const { seats } = req.body as { seats?: number };
  const last = await prisma.restaurantTable.findFirst({ where: { restaurantId: req.params.id }, orderBy: { number: "desc" } });
  const table = await prisma.restaurantTable.create({
    data: { restaurantId: req.params.id, number: (last?.number ?? 0) + 1, seats: seats && seats > 0 ? seats : 4 }
  });
  res.status(201).json(serializeTable(table, "free"));
});

restaurantTablesRouter.get("/:id/tables/:number/comanda", ...staffGuard, async (req, res) => {
  const table = await findTable(req.params.id, parseInt(req.params.number, 10));
  if (!table) return res.status(404).json({ error: "table not found" });
  const orders = await openOrdersForTable(req.params.id, table);
  res.json(buildComanda(table, orders));
});

restaurantTablesRouter.post("/:id/tables/:number/close", ...staffGuard, async (req, res) => {
  const table = await findTable(req.params.id, parseInt(req.params.number, 10));
  if (!table) return res.status(404).json({ error: "table not found" });
  const orders = await openOrdersForTable(req.params.id, table);
  await prisma.order.updateMany({ where: { id: { in: orders.map((o) => o.id) }, status: { not: "served" } }, data: { status: "served" } });
  await prisma.restaurantTable.update({ where: { id: table.id }, data: { openedAt: null } });
  res.json({ ok: true });
});

restaurantTablesRouter.post("/:id/tables/:number/transfer", ...staffGuard, async (req, res) => {
  const { toNumber } = req.body as { toNumber?: number };
  const fromNumber = parseInt(req.params.number, 10);
  if (!toNumber || toNumber === fromNumber) return res.status(400).json({ error: "invalid destination table" });
  const from = await findTable(req.params.id, fromNumber);
  if (!from) return res.status(404).json({ error: "table not found" });
  let to = await findTable(req.params.id, toNumber);
  if (!to) return res.status(404).json({ error: "destination table not found" });

  const orders = await openOrdersForTable(req.params.id, from);
  await prisma.order.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { tableNumber: toNumber } });
  await prisma.restaurantTable.update({ where: { id: to.id }, data: { openedAt: to.openedAt ?? from.openedAt } });
  await prisma.restaurantTable.update({ where: { id: from.id }, data: { openedAt: null } });
  res.json({ ok: true });
});

restaurantTablesRouter.get("/:id/tables/:number/qr", ...staffGuard, async (req, res) => {
  const number = parseInt(req.params.number, 10);
  const table = await findTable(req.params.id, number);
  if (!table) return res.status(404).json({ error: "table not found" });
  res.json({ tableCode: String(number) });
});

restaurantTablesRouter.get("/:id/waiter-calls", ...staffGuard, async (req, res) => {
  const calls = await prisma.waiterCall.findMany({
    where: { restaurantId: req.params.id, resolvedAt: null },
    orderBy: { createdAt: "asc" }
  });
  res.json(calls.map(serializeWaiterCall));
});

restaurantTablesRouter.post("/:id/waiter-calls/:callId/resolve", ...staffGuard, async (req, res) => {
  const call = await prisma.waiterCall.findUnique({ where: { id: req.params.callId } });
  if (!call || call.restaurantId !== req.params.id) return res.status(404).json({ error: "call not found" });
  await prisma.waiterCall.update({ where: { id: call.id }, data: { resolvedAt: new Date() } });
  res.json({ ok: true });
});
