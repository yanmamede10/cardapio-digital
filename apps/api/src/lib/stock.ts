import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

type ProductRecipe = { id: string; composed: boolean; components: { componentId: string; quantity: number }[] };
type Recipe = Record<string, number>;
type SoldLine = { productId: string | null; quantity: number; recipe?: Recipe | null; options?: { productId?: string | null; quantity?: number }[] };

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** What one unit of a dish takes from stock: its ficha técnica when composed, else the product itself (none without a product). */
export const recipeOf = (product: ProductRecipe | null | undefined): Recipe =>
  !product ? {} : product.composed ? Object.fromEntries(product.components.map((c) => [c.componentId, c.quantity])) : { [product.id]: 1 };

/**
 * Stock to take out per product for the sold lines: each line's recipe (frozen when ordered; a line without one reads its
 * product's today), plus each chosen option with stock (Bacon extra). One level only — the products route never lets a
 * composed product be a component, so there's nothing to recurse into.
 */
export function stockOut(lines: SoldLine[], products: Map<string, ProductRecipe>): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, qty: number) => out.set(id, round3((out.get(id) ?? 0) + qty));
  for (const line of lines) {
    for (const o of line.options ?? []) if (o.productId && o.quantity) add(o.productId, o.quantity * line.quantity);
    const recipe = line.recipe ?? recipeOf(line.productId ? products.get(line.productId) : undefined);
    for (const [id, qty] of Object.entries(recipe)) add(id, qty * line.quantity);
  }
  return out;
}

/** Decrements stock for everything sold in `orders` and logs one "out" movement per product. Stock may go negative. */
export async function takeStockForOrders(
  restaurantId: string,
  orders: { lines: { itemId: string; quantity: number; selectedOptionsJson?: string; stockJson?: string | null }[] }[],
  source: string
) {
  const lines = orders.flatMap((o) => o.lines);
  if (lines.length === 0) return;
  // Only lines ordered before OrderLine.stockJson need today's Cardápio link and ficha técnica.
  const legacy = lines.filter((l) => !l.stockJson);
  const items = await prisma.menuItem.findMany({ where: { id: { in: [...new Set(legacy.map((l) => l.itemId))] } }, select: { id: true, productId: true } });
  const productOf = new Map(items.map((i) => [i.id, i.productId]));
  const products = await prisma.product.findMany({
    where: { restaurantId, id: { in: items.flatMap((i) => (i.productId ? [i.productId] : [])) } },
    include: { components: true }
  });
  const out = stockOut(
    lines.map((l) => ({
      productId: productOf.get(l.itemId) ?? null,
      quantity: l.quantity,
      recipe: l.stockJson ? (JSON.parse(l.stockJson) as Recipe) : null,
      options: JSON.parse(l.selectedOptionsJson ?? "[]")
    })),
    new Map(products.map((p) => [p.id, p]))
  );
  if (out.size === 0) return;
  // One statement: the shared insumos' rows (pão, blend…) stay locked for one round trip, not one UPDATE + INSERT per
  // insumo — 29 comandas closing at once used to queue behind those locks for seconds. Locked in id order first, as in the
  // XML import: two closes over the same insumos used to lock them in opposite orders and deadlock (the loser's stock and
  // receivable were lost).
  const values = Prisma.join([...out].map(([id, quantity]) => Prisma.sql`(${id}, ${quantity}::double precision)`));
  await prisma.$executeRaw`
    WITH "out"("id", "quantity") AS (VALUES ${values}),
    "locked" AS MATERIALIZED (SELECT "id" FROM "Product" WHERE "id" IN (SELECT "id" FROM "out") ORDER BY "id" FOR UPDATE),
    "taken" AS (UPDATE "Product" p SET "stock" = p."stock" - o."quantity" FROM "out" o JOIN "locked" l ON l."id" = o."id" WHERE p."id" = o."id")
    INSERT INTO "StockMovement" ("id", "restaurantId", "productId", "kind", "quantity", "source")
    SELECT gen_random_uuid()::text, ${restaurantId}, "id", 'out', "quantity", ${source} FROM "out"`;
}
