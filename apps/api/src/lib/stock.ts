import { prisma } from "../db.js";

type ProductRecipe = { id: string; composed: boolean; components: { componentId: string; quantity: number }[] };
type SoldLine = { productId: string | null; quantity: number; options?: { productId?: string | null; quantity?: number }[] };

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Stock to take out per product for the sold lines: a composed product consumes its ficha técnica,
 * anything else consumes itself; each chosen option with stock (Bacon extra) adds its own. One level only — the products route never lets a composed
 * product be a component, so there's nothing to recurse into.
 */
export function stockOut(lines: SoldLine[], products: Map<string, ProductRecipe>): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, qty: number) => out.set(id, round3((out.get(id) ?? 0) + qty));
  for (const line of lines) {
    for (const o of line.options ?? []) if (o.productId && o.quantity) add(o.productId, o.quantity * line.quantity);
    const product = line.productId ? products.get(line.productId) : undefined;
    if (!product) continue; // legacy menu item with no catalog product — nothing to track
    if (product.composed) product.components.forEach((c) => add(c.componentId, c.quantity * line.quantity));
    else add(product.id, line.quantity);
  }
  return out;
}

/** Decrements stock for everything sold in `orders` and logs one "out" movement per product. Stock may go negative. */
export async function takeStockForOrders(restaurantId: string, orders: { lines: { itemId: string; quantity: number; selectedOptionsJson?: string }[] }[], source: string) {
  const lines = orders.flatMap((o) => o.lines);
  if (lines.length === 0) return;
  const items = await prisma.menuItem.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.itemId))] } }, select: { id: true, productId: true } });
  const productOf = new Map(items.map((i) => [i.id, i.productId]));
  const products = await prisma.product.findMany({
    where: { restaurantId, id: { in: items.flatMap((i) => (i.productId ? [i.productId] : [])) } },
    include: { components: true }
  });
  const out = stockOut(
    lines.map((l) => ({ productId: productOf.get(l.itemId) ?? null, quantity: l.quantity, options: JSON.parse(l.selectedOptionsJson ?? "[]") })),
    new Map(products.map((p) => [p.id, p]))
  );
  // Rows locked in id order, as in the XML import: two comandas closing at once over the same insumos (pão, blend…)
  // used to lock them in opposite orders and deadlock — the loser's stock and receivable were lost.
  await prisma.$transaction(
    [...out].sort(([a], [b]) => a.localeCompare(b)).flatMap(([productId, quantity]) => [
      prisma.product.update({ where: { id: productId }, data: { stock: { decrement: quantity } } }),
      prisma.stockMovement.create({ data: { restaurantId, productId, kind: "out", quantity, source } })
    ])
  );
}
