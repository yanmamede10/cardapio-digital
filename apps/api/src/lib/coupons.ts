import type { Coupon } from "@prisma/client";
import { prisma } from "../db.js";

/** Why a code typed in the checkout isn't usable — the same rules Promoções shows. */
export const COUPON_USED_UP = "Este cupom já foi usado o máximo de vezes.";

/**
 * A code typed in the cardápio's checkout → that restaurant's coupon (Promoções), if it can be used on a delivery order now,
 * by the rules the Promoções screen already has: switched on, not "Expirado" (validUntil), uses left (usedCount of
 * usageLimit), channel Delivery or Ambos. Otherwise the reason, for the customer to read. One function for
 * /api/coupons/apply and for the order, so they never disagree.
 */
export async function deliveryCoupon(restaurantId: unknown, code: unknown): Promise<{ coupon: Coupon } | { error: string }> {
  const typed = typeof code === "string" ? code.trim().toUpperCase() : ""; // Promoções saves codes in capitals
  if (!typed) return { error: "Digite o código do cupom." };
  const coupon = typeof restaurantId === "string" ? await prisma.coupon.findUnique({ where: { restaurantId_code: { restaurantId, code: typed } } }) : null;
  if (!coupon) return { error: "Cupom não encontrado neste restaurante." };
  if (!coupon.active) return { error: "Este cupom está pausado pelo restaurante." };
  if (coupon.validUntil.getTime() < Date.now()) return { error: "Este cupom expirou." };
  if (coupon.usedCount >= coupon.usageLimit) return { error: COUPON_USED_UP };
  if (coupon.channel === "table") return { error: "Este cupom vale só para pedidos na mesa." };
  // A combo (these dishes for R$ X) has no rule yet for a cart with extras or two of each: pending decision (F-1).
  if (coupon.kind !== "percent" && coupon.kind !== "fixed") return { error: "Cupom de combo ainda não vale no app." };
  return { coupon };
}
