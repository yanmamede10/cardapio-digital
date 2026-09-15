import { Router } from "express";
import { prisma } from "../db.js";
import { serializePaymentMethod } from "../lib/serialize.js";

export const paymentMethodsRouter = Router();

paymentMethodsRouter.get("/", async (_req, res) => {
  const rows = await prisma.paymentMethod.findMany();
  res.json(rows.map(serializePaymentMethod));
});
