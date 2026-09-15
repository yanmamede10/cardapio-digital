import { Router } from "express";

export const tablesRouter = Router();

const TABLE_RESTAURANT_ID = "fogo";

// Seed simplification: every table code resolves to the Fogo & Nó dining
// room (the only restaurant the design's table/QR flow ever shows). A real
// deployment would look up the physical table row a QR code encodes.
tablesRouter.get("/:tableCode", (req, res) => {
  const tableNumber = parseInt(req.params.tableCode, 10);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 99) {
    return res.status(404).json({ error: "table not found" });
  }
  res.json({ restaurantId: TABLE_RESTAURANT_ID, tableNumber });
});
