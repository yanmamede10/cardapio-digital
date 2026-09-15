import type { CouponResult } from "@cardapio/shared";

/**
 * Mirrors the design's coupon behavior: any non-empty code is accepted for a
 * flat 10% discount. Kept as one function so /api/coupons/apply and order
 * creation can never disagree about whether a code is valid.
 */
export function evaluateCoupon(code: string | null | undefined): CouponResult {
  const trimmed = (code ?? "").trim();
  if (!trimmed) {
    return { valid: false, discountPercent: 0, message: "Digite um código" };
  }
  return {
    valid: true,
    discountPercent: 10,
    message: "Cupom aplicado: 10% de desconto no subtotal."
  };
}
