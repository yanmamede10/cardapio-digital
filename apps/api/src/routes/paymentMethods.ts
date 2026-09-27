import { asyncRouter } from "../lib/router.js";
import { prisma } from "../db.js";
import { serializePaymentMethod } from "../lib/serialize.js";

export const paymentMethodsRouter = asyncRouter();

paymentMethodsRouter.get("/", async (_req, res) => {
  const rows = await prisma.paymentMethod.findMany();
  res.json(rows.map(serializePaymentMethod));
});
