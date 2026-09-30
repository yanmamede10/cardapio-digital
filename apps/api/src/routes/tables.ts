import { asyncRouter } from "../lib/router.js";
import { prisma } from "../db.js";

export const tablesRouter = asyncRouter();

// A table's QR carries its own random code (RestaurantTable.qrCode). Only a current code of an active restaurant resolves —
// anything else (an old code after "Gerar novo QR", a guess) is "mesa não encontrada".
tablesRouter.get("/:tableCode", async (req, res) => {
  const table = await prisma.restaurantTable.findUnique({
    where: { qrCode: req.params.tableCode },
    select: { restaurantId: true, number: true, restaurant: { select: { status: true, qrOrdering: true } } }
  });
  if (table?.restaurant.status !== "ativo") return res.status(404).json({ error: "table not found" });
  // The restaurant takes table orders through its waiters only (Configurações → Salão): the customer app says so.
  if (!table.restaurant.qrOrdering) return res.status(403).json({ error: "qr ordering is off" });
  res.json({ restaurantId: table.restaurantId, tableNumber: table.number });
});
