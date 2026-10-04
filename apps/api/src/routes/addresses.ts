import { asyncRouter } from "../lib/router.js";
import { prisma } from "../db.js";
import { requireStaff } from "../lib/auth.js";
import { serializeAddress } from "../lib/serialize.js";

export const addressesRouter = asyncRouter();

// G-1 (SEG-09): it was public and returned every address in the database. A customer's address is only the business of the
// restaurant that delivers to it: staff only, and only the addresses of the token's restaurant's orders (an Address has no
// restaurant or owner of its own).
addressesRouter.get("/", requireStaff, async (req, res) => {
  const orders = await prisma.order.findMany({ where: { restaurantId: req.staff!.restaurantId, addressId: { not: null } }, select: { addressId: true }, distinct: ["addressId"] });
  const rows = await prisma.address.findMany({ where: { id: { in: orders.map((o) => o.addressId!) } } });
  res.json(rows.map(serializeAddress));
});
