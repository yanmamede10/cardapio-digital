import { Router } from "express";
import type { CreateCouponRequest } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireRole, requireStaff } from "../lib/auth.js";
import { serializeCoupon } from "../lib/serialize.js";

export const dashboardCouponsRouter = Router();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.
const staffGuard = [requireStaff, requireOwnRestaurant, requireRole("owner", "manager")];

dashboardCouponsRouter.get("/:id/coupons", ...staffGuard, async (req, res) => {
  const { query } = req.query as { query?: string };
  const q = (query ?? "").trim().toLowerCase();
  const coupons = await prisma.coupon.findMany({ where: { restaurantId: req.params.id }, orderBy: { validUntil: "desc" } });
  const filtered = q ? coupons.filter((c) => c.code.toLowerCase().includes(q)) : coupons;
  res.json(filtered.map(serializeCoupon));
});

dashboardCouponsRouter.post("/:id/coupons", ...staffGuard, async (req, res) => {
  const body = req.body as CreateCouponRequest;
  if (!body.code || !body.kind || !body.channel || !body.validUntil) {
    return res.status(400).json({ error: "code, kind, channel and validUntil are required" });
  }
  const coupon = await prisma.coupon.create({
    data: {
      restaurantId: req.params.id,
      code: body.code.trim().toUpperCase(),
      kind: body.kind,
      value: body.value,
      channel: body.channel,
      validUntil: new Date(body.validUntil),
      usageLimit: body.usageLimit,
      comboItemIdsJson: body.comboItemIds ? JSON.stringify(body.comboItemIds) : null,
      comboPrice: body.comboPrice ?? null
    }
  });
  res.status(201).json(serializeCoupon(coupon));
});

dashboardCouponsRouter.patch("/:id/coupons/:couponId", ...staffGuard, async (req, res) => {
  const { active } = req.body as { active?: boolean };
  const existing = await prisma.coupon.findUnique({ where: { id: req.params.couponId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "coupon not found" });
  const coupon = await prisma.coupon.update({ where: { id: req.params.couponId }, data: { ...(active !== undefined ? { active } : {}) } });
  res.json(serializeCoupon(coupon));
});

dashboardCouponsRouter.delete("/:id/coupons/:couponId", ...staffGuard, async (req, res) => {
  const existing = await prisma.coupon.findUnique({ where: { id: req.params.couponId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "coupon not found" });
  await prisma.coupon.delete({ where: { id: req.params.couponId } });
  res.status(204).end();
});

dashboardCouponsRouter.post("/:id/coupons/:couponId/duplicate", ...staffGuard, async (req, res) => {
  const original = await prisma.coupon.findUnique({ where: { id: req.params.couponId } });
  if (!original || original.restaurantId !== req.params.id) return res.status(404).json({ error: "coupon not found" });
  let code = `${original.code}-COPIA`;
  let n = 2;
  while (await prisma.coupon.findUnique({ where: { restaurantId_code: { restaurantId: req.params.id, code } } })) {
    code = `${original.code}-COPIA${n++}`;
  }
  const copy = await prisma.coupon.create({
    data: {
      restaurantId: original.restaurantId,
      code,
      kind: original.kind,
      value: original.value,
      channel: original.channel,
      validUntil: original.validUntil,
      usageLimit: original.usageLimit,
      active: false,
      comboItemIdsJson: original.comboItemIdsJson,
      comboPrice: original.comboPrice
    }
  });
  res.status(201).json(serializeCoupon(copy));
});
