import { randomUUID } from "node:crypto";
import { asyncRouter } from "../lib/router.js";
import multer from "multer";
import { LEVEL, type MenuItemOptionGroup, type UpsertMenuItemRequest } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireModule, requireOwnRestaurant, requireMinRole, requireStaff } from "../lib/auth.js";
import { serializeMenuItem } from "../lib/serialize.js";
import { uploadPublicFile } from "../lib/storage.js";

export const menuManagementRouter = asyncRouter();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.
const staffGuard = [requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.ADMINISTRADOR), requireModule("cardapio")];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_NAME_LENGTH = 80;
const MAX_SHORT_DESCRIPTION_LENGTH = 200;
const MAX_LONG_DESCRIPTION_LENGTH = 500;

function textFieldError(body: { name?: string; shortDescription?: string; longDescription?: string }): string | null {
  if (body.name !== undefined && body.name.length > MAX_NAME_LENGTH) return `name must be at most ${MAX_NAME_LENGTH} characters`;
  if (body.shortDescription !== undefined && body.shortDescription.length > MAX_SHORT_DESCRIPTION_LENGTH) {
    return `shortDescription must be at most ${MAX_SHORT_DESCRIPTION_LENGTH} characters`;
  }
  if (body.longDescription !== undefined && body.longDescription.length > MAX_LONG_DESCRIPTION_LENGTH) {
    return `longDescription must be at most ${MAX_LONG_DESCRIPTION_LENGTH} characters`;
  }
  return null;
}

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

/** The dashboard edits only the "Adicionais" group (id "extra"); every other group (e.g. "Ponto da carne") is kept as is. */
function withExtras(currentJson: string, extras: UpsertMenuItemRequest["extras"]): string {
  const others = (JSON.parse(currentJson) as MenuItemOptionGroup[]).filter((g) => g.id !== "extra");
  return JSON.stringify([...others, ...JSON.parse(optionGroupsJsonFor(extras))]);
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
  const fieldError = textFieldError(body);
  if (fieldError) return res.status(400).json({ error: fieldError });
  const category = await prisma.menuCategory.findUnique({ where: { id: body.categoryId } });
  if (!category || category.restaurantId !== req.params.id) return res.status(400).json({ error: "unknown category" });

  // Desktop Cardápio links an existing catalog Produto. The mobile form still sends name/price
  // without a productId — it gets a Produto made for it so every dish stays catalog-backed.
  let product;
  if (body.productId) {
    product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product || product.restaurantId !== req.params.id || product.type !== "produto") return res.status(400).json({ error: "unknown product" });
    if (await prisma.menuItem.findFirst({ where: { productId: product.id } })) return res.status(409).json({ error: "este prato já está no cardápio" });
  } else {
    if (typeof body.name !== "string" || !body.name.trim() || typeof body.price !== "number") return res.status(400).json({ error: "productId or name and price are required" });
    product = await prisma.product.create({ data: { restaurantId: req.params.id, name: body.name, type: "produto", unit: "un", price: body.price } });
  }
  const shortDescription = body.shortDescription ?? "";

  const last = await prisma.menuItem.findFirst({ where: { restaurantId: req.params.id }, orderBy: { sortOrder: "desc" } });
  const item = await prisma.menuItem.create({
    data: {
      id: `${req.params.id}-${randomUUID()}`,
      restaurantId: req.params.id,
      categoryId: body.categoryId,
      productId: product.id,
      name: product.name,
      shortDescription,
      longDescription: body.longDescription || shortDescription,
      price: product.price,
      photoLabel: `foto · ${product.name.toLowerCase()}`,
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
  const fieldError = textFieldError(body);
  if (fieldError) return res.status(400).json({ error: fieldError });
  const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "item not found" });

  // Name/price belong to the catalog product (desktop edits them there). The mobile form still
  // sends them here — write them through to the product and every dish linked to it.
  if (existing.productId && (body.name !== undefined || body.price !== undefined)) {
    const product = await prisma.product.update({
      where: { id: existing.productId },
      data: { ...(body.name !== undefined ? { name: body.name } : {}), ...(body.price !== undefined ? { price: body.price } : {}) }
    });
    await prisma.menuItem.updateMany({ where: { productId: product.id }, data: { name: product.name, price: product.price } });
  }

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
      ...(body.extras !== undefined ? { optionGroupsJson: withExtras(existing.optionGroupsJson, body.extras) } : {})
    },
    include: { category: true }
  });
  res.json(serializeMenuItem(item, item.category.name));
});

// Esgotado/Disponível: any role — the kitchen is who knows the bacon ran out. Everything else on a dish is Administrador+.
menuManagementRouter.patch("/:id/items/:itemId/sold-out", requireStaff, requireOwnRestaurant, requireModule("cardapio"), async (req, res) => {
  const { soldOut } = req.body as { soldOut?: unknown };
  if (typeof soldOut !== "boolean") return res.status(400).json({ error: "soldOut must be true or false" });
  const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "item not found" });
  const item = await prisma.menuItem.update({ where: { id: existing.id }, data: { soldOut }, include: { category: true } });
  res.json(serializeMenuItem(item, item.category.name));
});

menuManagementRouter.post("/:id/items/:itemId/image", ...staffGuard, upload.single("file"), async (req, res) => {
  const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "item not found" });
  if (!req.file) return res.status(400).json({ error: "file is required" });

  const extension = IMAGE_TYPES[req.file.mimetype];
  if (!extension) return res.status(400).json({ error: `unsupported file type: ${req.file.mimetype}` });
  if (req.file.size > MAX_IMAGE_BYTES) return res.status(400).json({ error: `file too large — limit is ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB` });

  let url: string;
  try {
    url = await uploadPublicFile({ buffer: req.file.buffer, contentType: req.file.mimetype, folder: `restaurants/${req.params.id}/products`, extension });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ error: "storage is not configured" });
  }

  const item = await prisma.menuItem.update({ where: { id: req.params.itemId }, data: { imageUrl: url }, include: { category: true } });
  res.status(201).json(serializeMenuItem(item, item.category.name));
});

menuManagementRouter.delete("/:id/items/:itemId", ...staffGuard, async (req, res) => {
  const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "item not found" });
  await prisma.menuItem.delete({ where: { id: req.params.itemId } });
  res.status(204).end();
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
      productId: original.productId,
      name: `${original.name} (cópia)`,
      shortDescription: original.shortDescription,
      longDescription: original.longDescription,
      price: original.price,
      photoLabel: original.photoLabel,
      imageUrl: original.imageUrl,
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
