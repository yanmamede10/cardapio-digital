import { Router } from "express";
import { LEVEL, type AnalyticsPeriod } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireModule, requireOwnRestaurant, requireMinRole, requireStaff } from "../lib/auth.js";
import { buildAnalytics, buildShiftStats } from "../lib/analytics.js";
import { serializeCharge } from "../lib/serialize.js";
import { round2 } from "../lib/pricing.js";

export const reportsRouter = Router();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.

reportsRouter.get("/:id/analytics", requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.ADMINISTRADOR), requireModule("relatorios"), async (req, res) => {
  const { period } = req.query as { period?: AnalyticsPeriod };
  res.json(await buildAnalytics(req.params.id, period || "today"));
});

// Shift stats power the operational Central de Pedidos view, so any staff role can read them.
reportsRouter.get("/:id/shift-stats", requireStaff, requireOwnRestaurant, requireModule("pedidos"), async (req, res) => {
  res.json(await buildShiftStats(req.params.id));
});

reportsRouter.get("/:id/finance", requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.ADMINISTRADOR), async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!restaurant) return res.status(404).json({ error: "restaurant not found" });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const deliveryOrders = await prisma.order.findMany({
    where: { restaurantId: req.params.id, mode: "delivery", status: { not: "cancelled" }, createdAt: { gte: monthStart } }
  });
  const deliveryFeeMonthToDate = round2(deliveryOrders.reduce((t, o) => t + o.deliveryFee, 0));

  const charges = await prisma.billingCharge.findMany({ where: { restaurantId: req.params.id }, orderBy: { date: "desc" } });

  res.json({
    deliveryFeeMonthToDate,
    deliveryFeeCap: restaurant.deliveryFeeCap,
    planPrice: restaurant.planPrice,
    planDueDate: restaurant.planDueDate ? restaurant.planDueDate.toISOString() : new Date().toISOString(),
    planModules: JSON.parse(restaurant.planModulesJson) as string[],
    charges: charges.map(serializeCharge)
  });
});
