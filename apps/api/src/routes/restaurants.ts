import { Router } from "express";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireStaff } from "../lib/auth.js";
import { serializeMenuItem, serializeOrder, serializeRestaurant } from "../lib/serialize.js";

export const restaurantsRouter = Router();

// Staff-facing order queue: every order placed today for this restaurant,
// regardless of which guest session created it (unlike GET /api/orders,
// which is scoped to the caller's own X-Session-Id for the customer app).
restaurantsRouter.get("/:id/orders", requireStaff, requireOwnRestaurant, async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const orders = await prisma.order.findMany({
    where: { restaurantId: req.params.id, createdAt: { gte: startOfDay } },
    include: { lines: true },
    orderBy: { createdAt: "asc" }
  });
  res.json(orders.map(serializeOrder));
});

restaurantsRouter.get("/", async (req, res) => {
  const { query, cuisine, sort } = req.query as { query?: string; cuisine?: string; sort?: string };
  const all = await prisma.restaurant.findMany({ orderBy: { sortOrder: "asc" } });

  let list = all.filter((r) => {
    const okCuisine = !cuisine || cuisine === "Todos" || JSON.parse(r.cuisineTagsJson).includes(cuisine);
    const q = (query ?? "").trim().toLowerCase();
    const okQuery = !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q);
    return okCuisine && okQuery;
  });

  if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
  else if (sort === "time") list = [...list].sort((a, b) => a.etaMinMinutes - b.etaMinMinutes);
  else if (sort === "fee") list = [...list].sort((a, b) => a.deliveryFee - b.deliveryFee);

  res.json(list.map(serializeRestaurant));
});

restaurantsRouter.get("/:id", async (req, res) => {
  const r = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeRestaurant(r));
});

restaurantsRouter.get("/:id/categories", async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!restaurant) return res.status(404).json({ error: "restaurant not found" });
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: req.params.id },
    orderBy: { sortOrder: "asc" }
  });
  res.json(
    categories.map((c) => ({ id: c.id, restaurantId: c.restaurantId, name: c.name, sortOrder: c.sortOrder }))
  );
});

restaurantsRouter.get("/:id/items", async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!restaurant) return res.status(404).json({ error: "restaurant not found" });
  const { categoryId } = req.query as { categoryId?: string };
  const items = await prisma.menuItem.findMany({
    where: { restaurantId: req.params.id, ...(categoryId ? { categoryId } : {}) },
    orderBy: { sortOrder: "asc" },
    include: { category: true }
  });
  res.json(items.map((it) => serializeMenuItem(it, it.category.name)));
});

restaurantsRouter.get("/:id/items/:itemId", async (req, res) => {
  const item = await prisma.menuItem.findUnique({
    where: { id: req.params.itemId },
    include: { category: true }
  });
  if (!item || item.restaurantId !== req.params.id) {
    return res.status(404).json({ error: "item not found" });
  }
  res.json(serializeMenuItem(item, item.category.name));
});
