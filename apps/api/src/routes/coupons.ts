import { asyncRouter } from "../lib/router.js";
import { evaluateCoupon } from "../lib/coupons.js";

export const couponsRouter = asyncRouter();

couponsRouter.post("/apply", (req, res) => {
  const { code } = req.body as { code?: string };
  res.json(evaluateCoupon(code));
});
