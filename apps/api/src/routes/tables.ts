import { asyncRouter } from "../lib/router.js";
import { prisma } from "../db.js";

export const tablesRouter = asyncRouter();

// A table's QR encodes "<restaurantId>.<number>" (restaurant ids are [a-z0-9-], so the last "." splits them).
// Only an existing table of an active restaurant resolves — anything else is "mesa não encontrada".
tablesRouter.get("/:tableCode", async (req, res) => {
  const code = req.params.tableCode;
  const dot = code.lastIndexOf(".");
  const restaurantId = code.slice(0, dot);
  const tableNumber = Number(code.slice(dot + 1));
  if (dot < 1 || !Number.isInteger(tableNumber)) return res.status(404).json({ error: "table not found" });
  const table = await prisma.restaurantTable.findUnique({
    where: { restaurantId_number: { restaurantId, number: tableNumber } },
    select: { restaurant: { select: { status: true } } }
  });
  if (table?.restaurant.status !== "ativo") return res.status(404).json({ error: "table not found" });
  res.json({ restaurantId, tableNumber });
});
