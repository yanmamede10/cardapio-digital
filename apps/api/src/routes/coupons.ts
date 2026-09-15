import { Router } from "express";
import { evaluateCoupon } from "../lib/coupons.js";

export const couponsRouter = Router();

couponsRouter.post("/apply", (req, res) => {
  const { code } = req.body as { code?: string };
  res.json(evaluateCoupon(code));
});
