import { asyncRouter } from "../lib/router.js";
import { LEVEL, PRODUCT_UNITS, type UpsertProductRequest, type XmlImportRequest } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireModule, requireOwnRestaurant, requireMinRole, requireStaff } from "../lib/auth.js";
import { serializeMovement, serializeProduct } from "../lib/serialize.js";
import { round3 } from "../lib/stock.js";

export const productsRouter = asyncRouter();
// Applied per-route (not via router.use) — several routers share the "/api/restaurants" mount point.
const staffGuard = [requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.ADMINISTRADOR), requireModule("produtos")];
const withComponents = { components: { include: { component: true } } } as const;
const MAX_NAME_LENGTH = 80;
const MAX_TAX_CODE_LENGTH = 20;

const isAmount = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

async function productError(restaurantId: string, body: UpsertProductRequest, selfId?: string): Promise<string | null> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) return `name is required (max ${MAX_NAME_LENGTH} characters)`;
  if (body.type !== "produto" && body.type !== "insumo") return "type must be produto or insumo";
  if (!(PRODUCT_UNITS as readonly string[]).includes(body.unit)) return `unit must be one of ${PRODUCT_UNITS.join(", ")}`;
  if (!isAmount(body.price) || !isAmount(body.cost)) return "price and cost must be non-negative numbers";
  if (!isAmount(body.taxRate) || body.taxRate > 100) return "taxRate must be between 0 and 100";
  if (typeof body.ncm !== "string" || typeof body.cst !== "string" || body.ncm.length > MAX_TAX_CODE_LENGTH || body.cst.length > MAX_TAX_CODE_LENGTH) {
    return `ncm and cst must be at most ${MAX_TAX_CODE_LENGTH} characters`;
  }
  if (!body.composed) return null;

  if (body.type !== "produto") return "only a produto can be composed";
  const lines = Array.isArray(body.components) ? body.components : [];
  if (lines.length === 0) return "a composed product needs at least one component";
  if (lines.some((l) => typeof l.quantity !== "number" || !Number.isFinite(l.quantity) || l.quantity <= 0)) return "component quantities must be positive";
  const ids = lines.map((l) => l.componentId);
  if (new Set(ids).size !== ids.length) return "each component can appear only once";
  if (selfId && ids.includes(selfId)) return "a product can't be its own component";
  const found = await prisma.product.findMany({ where: { restaurantId, id: { in: ids } } });
  if (found.length !== ids.length) return "unknown component";
  // One level of composition keeps stock/cost math non-recursive (see lib/stock.ts).
  if (found.some((p) => p.composed)) return "a composed product can't be used as a component";
  return null;
}

async function loadProduct(id: string) {
  return prisma.product.findUniqueOrThrow({ where: { id }, include: withComponents });
}

productsRouter.get("/:id/products", ...staffGuard, async (req, res) => {
  const products = await prisma.product.findMany({ where: { restaurantId: req.params.id }, orderBy: { name: "asc" }, include: withComponents });
  res.json(products.map(serializeProduct));
});

productsRouter.post("/:id/products", ...staffGuard, async (req, res) => {
  const body = req.body as UpsertProductRequest;
  const error = await productError(req.params.id, body);
  if (error) return res.status(400).json({ error });
  const isProduto = body.type === "produto";
  const created = await prisma.product.create({
    data: {
      restaurantId: req.params.id,
      name: body.name.trim(),
      type: body.type,
      unit: body.unit,
      price: isProduto ? body.price : 0,
      cost: body.cost,
      ncm: body.ncm.trim(),
      cst: body.cst.trim(),
      taxRate: body.taxRate,
      composed: !!body.composed,
      components: body.composed ? { create: body.components.map((c) => ({ componentId: c.componentId, quantity: c.quantity })) } : undefined
    }
  });
  res.status(201).json(serializeProduct(await loadProduct(created.id)));
});

// Type is fixed after creation (a produto may already be on the menu; an insumo may be in a ficha técnica).
productsRouter.patch("/:id/products/:productId", ...staffGuard, async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.productId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "product not found" });
  const body = { ...(req.body as UpsertProductRequest), type: existing.type as UpsertProductRequest["type"] };
  const error = await productError(req.params.id, body, existing.id);
  if (error) return res.status(400).json({ error });
  if (body.composed && !existing.composed && (await prisma.productComponent.count({ where: { componentId: existing.id } })) > 0) {
    return res.status(409).json({ error: "este item é usado na composição de outro produto e não pode virar composto" });
  }
  const name = body.name.trim();
  const price = existing.type === "produto" ? body.price : 0;
  await prisma.$transaction([
    prisma.productComponent.deleteMany({ where: { productId: existing.id } }),
    prisma.product.update({
      where: { id: existing.id },
      data: {
        name,
        unit: body.unit,
        price,
        cost: body.cost,
        ncm: body.ncm.trim(),
        cst: body.cst.trim(),
        taxRate: body.taxRate,
        composed: !!body.composed,
        components: body.composed ? { create: body.components.map((c) => ({ componentId: c.componentId, quantity: c.quantity })) } : undefined
      }
    }),
    // Dishes on the Cardápio carry a copy of name/price that ordering reads — keep it in sync.
    prisma.menuItem.updateMany({ where: { productId: existing.id }, data: { name, price } })
  ]);
  res.json(serializeProduct(await loadProduct(existing.id)));
});

productsRouter.get("/:id/stock-movements", ...staffGuard, async (req, res) => {
  // ponytail: last 500 only, add paging when a restaurant outgrows it
  const movements = await prisma.stockMovement.findMany({
    where: { restaurantId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { product: true }
  });
  res.json(movements.map(serializeMovement));
});

// Ajuste manual: stock that arrives without an NF-e, losses, and the physical count (which sets the stock and logs the
// difference). Composed products have no stock of their own.
const ADJUST_SOURCE = { in: "Entrada manual", out: "Saída manual", count: "Contagem de estoque" } as const;
productsRouter.post("/:id/stock-movements/adjust", ...staffGuard, async (req, res) => {
  const { productId, kind, quantity, reason } = req.body as { productId?: string; kind?: keyof typeof ADJUST_SOURCE; quantity?: unknown; reason?: unknown };
  if (!kind || !(kind in ADJUST_SOURCE)) return res.status(400).json({ error: "kind must be in, out or count" });
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0 || (kind !== "count" && quantity === 0) || quantity > 1e6) {
    return res.status(400).json({ error: "quantity must be a positive number (zero only for a count)" });
  }
  if (reason !== undefined && (typeof reason !== "string" || reason.length > MAX_NAME_LENGTH)) return res.status(400).json({ error: `reason must be at most ${MAX_NAME_LENGTH} characters` });
  const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;
  if (!product || product.restaurantId !== req.params.id) return res.status(404).json({ error: "product not found" });
  if (product.composed) return res.status(400).json({ error: "produto com ficha técnica não tem estoque próprio: ajuste os itens da composição" });

  const delta = round3(kind === "count" ? quantity - product.stock : kind === "in" ? quantity : -quantity);
  const source = [ADJUST_SOURCE[kind], typeof reason === "string" && reason.trim()].filter(Boolean).join(": ");
  if (delta !== 0) {
    await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: kind === "count" ? { stock: quantity } : { stock: { increment: delta } } }),
      prisma.stockMovement.create({ data: { restaurantId: req.params.id, productId: product.id, kind: delta > 0 ? "in" : "out", quantity: Math.abs(delta), source } })
    ]);
  }
  res.json(serializeProduct(await loadProduct(product.id)));
});

// NF-e uCom → catalog unit. ponytail: no conversion (a "CX" of 12 enters as 1 un) — map per supplier if it bites.
const XML_UNITS: Record<string, string> = { UN: "un", UND: "un", UNID: "un", KG: "kg", G: "g", GR: "g", L: "L", LT: "L", ML: "ml" };

/** Supplier NF-e entry: each item is matched to a catalog product by name (or created as an insumo),
 *  its stock goes up and its cost moves to the weighted average of old stock and this purchase. */
productsRouter.post("/:id/stock-movements/xml", ...staffGuard, async (req, res) => {
  const body = req.body as XmlImportRequest;
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!fileName || items.length === 0 || items.length > 500) return res.status(400).json({ error: "fileName and 1–500 items are required" });
  const bad = items.find(
    (i) => typeof i.name !== "string" || !i.name.trim() || i.name.length > MAX_NAME_LENGTH || !(isAmount(i.quantity) && i.quantity > 0) || !isAmount(i.unitCost)
  );
  if (bad) return res.status(400).json({ error: `invalid item: ${String(bad?.name ?? "")}` });

  const restaurantId = req.params.id;
  const touched = new Map<string, { id: string; stock: number; cost: number; added: number }>();
  const movements: { productId: string; quantity: number }[] = [];
  for (const item of items) {
    const name = item.name.trim();
    const key = name.toLowerCase();
    let p = touched.get(key);
    if (!p) {
      const found =
        (await prisma.product.findFirst({ where: { restaurantId, name: { equals: name, mode: "insensitive" } } })) ??
        (await prisma.product.create({
          data: {
            restaurantId,
            name,
            type: "insumo",
            unit: XML_UNITS[String(item.unit).toUpperCase()] ?? "un",
            ncm: String(item.ncm ?? "").slice(0, MAX_TAX_CODE_LENGTH),
            cost: item.unitCost
          }
        }));
      p = { id: found.id, stock: found.stock, cost: found.cost, added: 0 };
      touched.set(key, p);
    }
    const base = Math.max(p.stock, 0);
    p.cost = (base * p.cost + item.quantity * item.unitCost) / (base + item.quantity);
    p.stock += item.quantity;
    p.added += item.quantity;
    movements.push({ productId: p.id, quantity: item.quantity });
  }
  // Increment (not set) stock so a comanda closed meanwhile isn't overwritten.
  await prisma.$transaction([
    ...[...touched.values()].sort((a, b) => a.id.localeCompare(b.id)).map((p) => // id order, like lib/stock.ts: no deadlock
      prisma.product.update({ where: { id: p.id }, data: { stock: { increment: p.added }, cost: Math.round(p.cost * 10000) / 10000 } })
    ),
    ...movements.map((m) => prisma.stockMovement.create({ data: { restaurantId, productId: m.productId, kind: "in", quantity: m.quantity, source: fileName } }))
  ]);
  res.status(201).json({ imported: movements.length });
});
