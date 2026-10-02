import { brl, type CouponResult } from "@cardapio/shared";
import { asyncRouter } from "../lib/router.js";
import { deliveryCoupon } from "../lib/coupons.js";

export const couponsRouter = asyncRouter();

// The checkout's "Aplicar": is this code one of the restaurant's coupons, usable on delivery now? The order checks it again
// and computes the discount itself.
couponsRouter.post("/apply", async (req, res) => {
  const { restaurantId, code } = (req.body ?? {}) as { restaurantId?: unknown; code?: unknown };
  const found = await deliveryCoupon(restaurantId, code);
  if ("error" in found) return res.json({ valid: false, message: found.error, kind: null, value: 0 } satisfies CouponResult);
  const { kind, value } = found.coupon as { kind: "percent" | "fixed"; value: number };
  res.json({ valid: true, kind, value, message: `Cupom aplicado: ${kind === "percent" ? `${value.toLocaleString("pt-BR")}%` : brl(value)} de desconto no subtotal.` } satisfies CouponResult);
});
