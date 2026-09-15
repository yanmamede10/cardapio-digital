import { Router } from "express";
import type { FiscalInfo, OperatingHoursRow, RestaurantProfile, StaffRole } from "@cardapio/shared";
import { prisma } from "../db.js";
import { serializeFiscal, serializeHours, serializeProfile, serializeStaff } from "../lib/serialize.js";

export const settingsRouter = Router();

async function requireRestaurant(id: string) {
  return prisma.restaurant.findUnique({ where: { id } });
}

settingsRouter.get("/:id/profile", async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeProfile(r));
});

settingsRouter.patch("/:id/profile", async (req, res) => {
  const body = req.body as Partial<RestaurantProfile>;
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

settingsRouter.get("/:id/hours", async (req, res) => {
  const rows = await prisma.operatingHour.findMany({ where: { restaurantId: req.params.id } });
  res.json(serializeHours(rows));
});

settingsRouter.patch("/:id/hours", async (req, res) => {
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

settingsRouter.get("/:id/staff", async (req, res) => {
  const staff = await prisma.staffMember.findMany({ where: { restaurantId: req.params.id }, orderBy: { invitedAt: "asc" } });
  res.json(staff.map(serializeStaff));
});

settingsRouter.post("/:id/staff", async (req, res) => {
  const { name, email, role } = req.body as { name?: string; email?: string; role?: StaffRole };
  if (!name || !email || !role) return res.status(400).json({ error: "name, email and role are required" });
  const staff = await prisma.staffMember.create({ data: { restaurantId: req.params.id, name, email, role } });
  res.status(201).json(serializeStaff(staff));
});

settingsRouter.get("/:id/fiscal", async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeFiscal(r));
});

settingsRouter.patch("/:id/fiscal", async (req, res) => {
  const body = req.body as Partial<FiscalInfo>;
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
