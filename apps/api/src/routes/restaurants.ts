import { asyncRouter } from "../lib/router.js";
import { prisma } from "../db.js";
import { requireModule, requireOwnRestaurant, requireStaff } from "../lib/auth.js";
import { serializeHours, serializeMenuItem, serializeOrder, serializeRestaurant } from "../lib/serialize.js";

export const restaurantsRouter = asyncRouter();

// Staff-facing order queue: every order placed today for this restaurant,
// regardless of which guest session created it (unlike GET /api/orders,
// which is scoped to the caller's own X-Session-Id for the customer app).
restaurantsRouter.get("/:id/orders", requireStaff, requireOwnRestaurant, requireModule("pedidos"), async (req, res) => {
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
  // RF-DESC-03: only active restaurants with the delivery module — the others still work by the table QR and the tablet.
  const all = await prisma.restaurant.findMany({ where: { status: "ativo", planModulesJson: { contains: "\"delivery\"" } }, orderBy: { sortOrder: "asc" } });

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

/** The customer app's view of a restaurant: only an active one exists. A pending (not yet launched) or deactivated one is
 *  "not found" on every public route — its menu, photos and appearance included. */
export const activeRestaurant = (id: string) => prisma.restaurant.findFirst({ where: { id, status: "ativo" } });

restaurantsRouter.get("/:id", async (req, res) => {
  const r = await activeRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  // I-1: the cardápio shows "Aberto agora" and today's hours from Configurações → Horários (public, like the menu).
  const hours = await prisma.operatingHour.findMany({ where: { restaurantId: r.id } });
  res.json({ ...serializeRestaurant(r), hours: serializeHours(hours) });
});

restaurantsRouter.get("/:id/categories", async (req, res) => {
  const restaurant = await activeRestaurant(req.params.id);
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
  const restaurant = await activeRestaurant(req.params.id);
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
  if (!item || item.restaurantId !== req.params.id || !(await activeRestaurant(req.params.id))) {
    return res.status(404).json({ error: "item not found" });
  }
  res.json(serializeMenuItem(item, item.category.name));
});
