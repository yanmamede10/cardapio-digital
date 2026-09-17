import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { UpsertMenuItemRequest } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireRole, requireStaff } from "../lib/auth.js";
import { serializeMenuItem } from "../lib/serialize.js";

export const menuManagementRouter = Router();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.
const staffGuard = [requireStaff, requireOwnRestaurant, requireRole("owner", "manager")];

function optionGroupsJsonFor(extras: UpsertMenuItemRequest["extras"]): string {
  if (!extras || extras.length === 0) return "[]";
  return JSON.stringify([
    {
      id: "extra",
      label: "Adicionais",
      type: "multi",
      hint: "opcional",
      options: extras.map((e, i) => ({ id: `extra-${i}`, label: e.name, priceDelta: e.priceDelta }))
    }
  ]);
}

async function itemsFor(restaurantId: string) {
  const items = await prisma.menuItem.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
    include: { category: true }
  });
  return items.map((it) => serializeMenuItem(it, it.category.name));
}

menuManagementRouter.post("/:id/items", ...staffGuard, async (req, res) => {
  const body = req.body as UpsertMenuItemRequest;
  const category = await prisma.menuCategory.findUnique({ where: { id: body.categoryId } });
  if (!category || category.restaurantId !== req.params.id) return res.status(400).json({ error: "unknown category" });

  const last = await prisma.menuItem.findFirst({ where: { restaurantId: req.params.id }, orderBy: { sortOrder: "desc" } });
  const item = await prisma.menuItem.create({
    data: {
      id: `${req.params.id}-${randomUUID()}`,
      restaurantId: req.params.id,
      categoryId: body.categoryId,
      name: body.name,
      shortDescription: body.shortDescription,
      longDescription: body.longDescription || body.shortDescription,
      price: body.price,
      photoLabel: `foto · ${body.name.toLowerCase()}`,
      soldOut: false,
      optionGroupsJson: optionGroupsJsonFor(body.extras),
      ...(body.scheduleLabel ? { scheduleLabel: body.scheduleLabel } : {}),
      sortOrder: (last?.sortOrder ?? -1) + 1
    },
    include: { category: true }
  });
  res.status(201).json(serializeMenuItem(item, item.category.name));
});

menuManagementRouter.patch("/:id/items/:itemId", ...staffGuard, async (req, res) => {
  const body = req.body as Partial<UpsertMenuItemRequest> & { soldOut?: boolean };
  const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "item not found" });

  const item = await prisma.menuItem.update({
    where: { id: req.params.itemId },
    data: {
      ...(body.categoryId ? { categoryId: body.categoryId } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
      ...(body.longDescription !== undefined ? { longDescription: body.longDescription } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
      ...(body.soldOut !== undefined ? { soldOut: body.soldOut } : {}),
      ...(body.scheduleLabel !== undefined ? { scheduleLabel: body.scheduleLabel } : {}),
      ...(body.extras !== undefined ? { optionGroupsJson: optionGroupsJsonFor(body.extras) } : {})
    },
    include: { category: true }
  });
  res.json(serializeMenuItem(item, item.category.name));
});

menuManagementRouter.post("/:id/items/:itemId/duplicate", ...staffGuard, async (req, res) => {
  const original = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  if (!original || original.restaurantId !== req.params.id) return res.status(404).json({ error: "item not found" });
  const last = await prisma.menuItem.findFirst({ where: { restaurantId: req.params.id }, orderBy: { sortOrder: "desc" } });
  const copy = await prisma.menuItem.create({
    data: {
      id: `${req.params.id}-${randomUUID()}`,
      restaurantId: original.restaurantId,
      categoryId: original.categoryId,
      name: `${original.name} (cópia)`,
      shortDescription: original.shortDescription,
      longDescription: original.longDescription,
      price: original.price,
      photoLabel: original.photoLabel,
      tag: original.tag,
      tagIcon: original.tagIcon,
      soldOut: true,
      optionGroupsJson: original.optionGroupsJson,
      sortOrder: (last?.sortOrder ?? -1) + 1
    },
    include: { category: true }
  });
  res.status(201).json(serializeMenuItem(copy, copy.category.name));
});

menuManagementRouter.post("/:id/items/:itemId/move", ...staffGuard, async (req, res) => {
  const { direction } = req.body as { direction?: "up" | "down" };
  const item = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  if (!item || item.restaurantId !== req.params.id) return res.status(404).json({ error: "item not found" });

  const siblings = await prisma.menuItem.findMany({ where: { categoryId: item.categoryId }, orderBy: { sortOrder: "asc" } });
  const index = siblings.findIndex((s) => s.id === item.id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex >= 0 && swapIndex < siblings.length) {
    const other = siblings[swapIndex];
    await prisma.$transaction([
      prisma.menuItem.update({ where: { id: item.id }, data: { sortOrder: other.sortOrder } }),
      prisma.menuItem.update({ where: { id: other.id }, data: { sortOrder: item.sortOrder } })
    ]);
  }
  res.json(await itemsFor(req.params.id));
});

menuManagementRouter.post("/:id/categories/:categoryId/move", ...staffGuard, async (req, res) => {
  const { direction } = req.body as { direction?: "up" | "down" };
  const category = await prisma.menuCategory.findUnique({ where: { id: req.params.categoryId } });
  if (!category || category.restaurantId !== req.params.id) return res.status(404).json({ error: "category not found" });

  const siblings = await prisma.menuCategory.findMany({ where: { restaurantId: req.params.id }, orderBy: { sortOrder: "asc" } });
  const index = siblings.findIndex((s) => s.id === category.id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex >= 0 && swapIndex < siblings.length) {
    const other = siblings[swapIndex];
    await prisma.$transaction([
      prisma.menuCategory.update({ where: { id: category.id }, data: { sortOrder: other.sortOrder } }),
      prisma.menuCategory.update({ where: { id: other.id }, data: { sortOrder: category.sortOrder } })
    ]);
  }
  const categories = await prisma.menuCategory.findMany({ where: { restaurantId: req.params.id }, orderBy: { sortOrder: "asc" } });
  res.json(categories.map((c) => ({ id: c.id, restaurantId: c.restaurantId, name: c.name, sortOrder: c.sortOrder })));
});
