import { Router } from "express";
import { prisma } from "../db.js";
import { serializeAddress } from "../lib/serialize.js";

export const addressesRouter = Router();

addressesRouter.get("/", async (_req, res) => {
  const rows = await prisma.address.findMany();
  res.json(rows.map(serializeAddress));
});
