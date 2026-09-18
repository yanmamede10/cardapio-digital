import { Router } from "express";
import type { SalonGrid } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireStaff } from "../lib/auth.js";
import { buildComanda, openOrdersForTable, statusForTable } from "../lib/tables.js";
import { serializeTable, serializeWaiterCall } from "../lib/serialize.js";

export const restaurantTablesRouter = Router();
// Applied per-route (not via router.use) because several routers share the
// "/api/restaurants" mount point — a path-based router.use() here would also
// run for sibling routers' routes (e.g. reports' /:id/shift-stats).
const staffGuard = [requireStaff, requireOwnRestaurant];
const MIN_GRID_SIZE = 6;
const MAX_GRID_SIZE = 14;

async function findTable(restaurantId: string, number: number) {
  return prisma.restaurantTable.findUnique({ where: { restaurantId_number: { restaurantId, number } } });
}

/** Mapa do salão — grid size plus every table's position, always returned together so the
 *  dashboard can sync both after a resize or a drag without a second round trip. */
async function buildSalonGrid(restaurantId: string): Promise<SalonGrid> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  const tables = await prisma.restaurantTable.findMany({ where: { restaurantId }, orderBy: { number: "asc" } });
  const withStatus = await Promise.all(
    tables.map(async (t) => serializeTable(t, statusForTable(t, await openOrdersForTable(restaurantId, t))))
  );
  return { gridSize: restaurant?.gridSize ?? MIN_GRID_SIZE, tables: withStatus };
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

restaurantTablesRouter.get("/:id/salon-grid", ...staffGuard, async (req, res) => {
  res.json(await buildSalonGrid(req.params.id));
});

restaurantTablesRouter.patch("/:id/salon-grid", ...staffGuard, async (req, res) => {
  const { gridSize } = req.body as { gridSize?: number };
  if (!Number.isInteger(gridSize) || gridSize! < MIN_GRID_SIZE || gridSize! > MAX_GRID_SIZE) {
    return res.status(400).json({ error: `gridSize must be an integer between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}` });
  }
  await prisma.restaurant.update({ where: { id: req.params.id }, data: { gridSize } });
  // Shrinking the grid strands any table whose position no longer fits — unposition it
  // instead of leaving it pointed at a cell that doesn't exist (0-indexed: valid is 0..gridSize-1).
  await prisma.restaurantTable.updateMany({
    where: { restaurantId: req.params.id, OR: [{ gridRow: { gte: gridSize } }, { gridCol: { gte: gridSize } }] },
    data: { gridRow: null, gridCol: null }
  });
  res.json(await buildSalonGrid(req.params.id));
});

restaurantTablesRouter.patch("/:id/tables/:number/position", ...staffGuard, async (req, res) => {
  const { gridRow, gridCol } = req.body as { gridRow?: number | null; gridCol?: number | null };
  const number = parseInt(req.params.number, 10);
  const table = await findTable(req.params.id, number);
  if (!table) return res.status(404).json({ error: "table not found" });

  const clearing = gridRow === null && gridCol === null;
  if (!clearing) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
    const gridSize = restaurant?.gridSize ?? MIN_GRID_SIZE;
    if (
      !Number.isInteger(gridRow) || !Number.isInteger(gridCol) ||
      gridRow! < 0 || gridRow! >= gridSize || gridCol! < 0 || gridCol! >= gridSize
    ) {
      return res.status(400).json({ error: `gridRow and gridCol must be integers between 0 and ${gridSize - 1}` });
    }
    const occupied = await prisma.restaurantTable.findFirst({
      where: { restaurantId: req.params.id, gridRow, gridCol, number: { not: number } }
    });
    if (occupied) return res.status(409).json({ error: `Mesa ${occupied.number} já está nessa célula` });
  }

  await prisma.restaurantTable.update({ where: { id: table.id }, data: { gridRow: clearing ? null : gridRow, gridCol: clearing ? null : gridCol } });
  res.json(await buildSalonGrid(req.params.id));
});

restaurantTablesRouter.patch("/:id/tables/:number", ...staffGuard, async (req, res) => {
  const { number: nextNumber } = req.body as { number?: number };
  const current = parseInt(req.params.number, 10);
  const table = await findTable(req.params.id, current);
  if (!table) return res.status(404).json({ error: "table not found" });
  if (table.openedAt) return res.status(409).json({ error: "feche a conta antes de editar o número da mesa" });
  if (!Number.isInteger(nextNumber) || nextNumber! <= 0) {
    return res.status(400).json({ error: "number must be a positive integer" });
  }
  if (nextNumber !== current) {
    const clash = await findTable(req.params.id, nextNumber!);
    if (clash) return res.status(409).json({ error: `já existe uma Mesa ${nextNumber}` });
  }
  await prisma.restaurantTable.update({ where: { id: table.id }, data: { number: nextNumber } });
  res.json(await buildSalonGrid(req.params.id));
});

restaurantTablesRouter.delete("/:id/tables/:number", ...staffGuard, async (req, res) => {
  const table = await findTable(req.params.id, parseInt(req.params.number, 10));
  if (!table) return res.status(404).json({ error: "table not found" });
  if (table.openedAt) return res.status(409).json({ error: "feche a conta antes de excluir a mesa" });
  await prisma.restaurantTable.delete({ where: { id: table.id } });
  res.json(await buildSalonGrid(req.params.id));
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
