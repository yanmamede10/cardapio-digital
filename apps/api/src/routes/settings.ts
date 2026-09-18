import { Router } from "express";
import type { FiscalInfo, OperatingHoursRow, RestaurantProfile, StaffRole, TaxRegime } from "@cardapio/shared";
import { prisma } from "../db.js";
import { hashPassword, requireOwnRestaurant, requireRole, requireStaff } from "../lib/auth.js";
import { serializeFiscal, serializeHours, serializeProfile, serializeStaff } from "../lib/serialize.js";

export const settingsRouter = Router();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.
const staffGuard = [requireStaff, requireOwnRestaurant, requireRole("owner", "manager")];
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_RESTAURANT_NAME_LENGTH = 80;
const MAX_CUISINE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 500;
const TAX_REGIMES: TaxRegime[] = ["mei", "simples_nacional", "lucro_presumido", "lucro_real", "lucro_arbitrado"];

async function requireRestaurant(id: string) {
  return prisma.restaurant.findUnique({ where: { id } });
}

settingsRouter.get("/:id/profile", ...staffGuard, async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeProfile(r));
});

settingsRouter.patch("/:id/profile", ...staffGuard, async (req, res) => {
  const body = req.body as Partial<RestaurantProfile>;
  if (body.name !== undefined && body.name.length > MAX_RESTAURANT_NAME_LENGTH) {
    return res.status(400).json({ error: `name must be at most ${MAX_RESTAURANT_NAME_LENGTH} characters` });
  }
  if (body.cuisineCategory !== undefined && body.cuisineCategory.length > MAX_CUISINE_LENGTH) {
    return res.status(400).json({ error: `cuisineCategory must be at most ${MAX_CUISINE_LENGTH} characters` });
  }
  if (body.description !== undefined && body.description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
  }
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.cuisineCategory !== undefined ? { cuisine: body.cuisineCategory } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {})
    }
  });
  res.json(serializeProfile(r));
});

settingsRouter.get("/:id/hours", ...staffGuard, async (req, res) => {
  const rows = await prisma.operatingHour.findMany({ where: { restaurantId: req.params.id } });
  res.json(serializeHours(rows));
});

settingsRouter.patch("/:id/hours", ...staffGuard, async (req, res) => {
  const { rows } = req.body as { rows?: OperatingHoursRow[] };
  if (!Array.isArray(rows)) return res.status(400).json({ error: "rows is required" });
  await prisma.$transaction(
    rows.map((row) =>
      prisma.operatingHour.upsert({
        where: { restaurantId_weekday: { restaurantId: req.params.id, weekday: row.weekday } },
        create: { restaurantId: req.params.id, weekday: row.weekday, lunch: row.lunch, dinner: row.dinner, isOpen: row.isOpen },
        update: { lunch: row.lunch, dinner: row.dinner, isOpen: row.isOpen }
      })
    )
  );
  const updated = await prisma.operatingHour.findMany({ where: { restaurantId: req.params.id } });
  res.json(serializeHours(updated));
});

settingsRouter.get("/:id/staff", ...staffGuard, async (req, res) => {
  const staff = await prisma.staffMember.findMany({ where: { restaurantId: req.params.id }, orderBy: { invitedAt: "asc" } });
  res.json(staff.map(serializeStaff));
});

settingsRouter.post("/:id/staff", ...staffGuard, async (req, res) => {
  const { name, email, role, password } = req.body as { name?: string; email?: string; role?: StaffRole; password?: string };
  if (!name || !email || !role) return res.status(400).json({ error: "name, email and role are required" });
  if (name.length > MAX_NAME_LENGTH) return res.status(400).json({ error: `name must be at most ${MAX_NAME_LENGTH} characters` });
  if (email.length > MAX_EMAIL_LENGTH) return res.status(400).json({ error: `email must be at most ${MAX_EMAIL_LENGTH} characters` });
  const staff = await prisma.staffMember.create({
    data: {
      restaurantId: req.params.id,
      name,
      email: email.trim().toLowerCase(),
      role,
      passwordHash: password ? hashPassword(password) : ""
    }
  });
  res.status(201).json(serializeStaff(staff));
});

settingsRouter.get("/:id/fiscal", ...staffGuard, async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeFiscal(r));
});

settingsRouter.patch("/:id/fiscal", ...staffGuard, async (req, res) => {
  const body = req.body as Partial<FiscalInfo>;
  if (body.taxRegime !== undefined && !TAX_REGIMES.includes(body.taxRegime)) {
    return res.status(400).json({ error: `taxRegime must be one of ${TAX_REGIMES.join(", ")}` });
  }
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      ...(body.cnpj !== undefined ? { cnpj: body.cnpj } : {}),
      ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
      ...(body.stateRegistration !== undefined ? { stateRegistration: body.stateRegistration } : {}),
      ...(body.taxRegime !== undefined ? { taxRegime: body.taxRegime } : {}),
      ...(body.fiscalAddress !== undefined ? { fiscalAddress: body.fiscalAddress } : {})
    }
  });
  res.json(serializeFiscal(r));
});
