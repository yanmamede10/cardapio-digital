import { Router } from "express";
import { PAYMENT_METHODS, type CreateFinanceEntryRequest } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireRole, requireStaff } from "../lib/auth.js";
import { round2 } from "../lib/pricing.js";
import { serializeFinanceEntry, serializeOrder } from "../lib/serialize.js";
import { serviceFee } from "../lib/tables.js";

export const financeRouter = Router();
// Applied per-route (not via router.use) — several routers share the "/api/restaurants" mount point.
const staffGuard = [requireStaff, requireOwnRestaurant, requireRole("owner", "manager")];
const MAX_TEXT_LENGTH = 120;

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
/** Today as YYYY-MM-DD in the app's zone (TZ is pinned in app.ts). */
const today = () => new Date().toLocaleDateString("sv-SE");

financeRouter.get("/:id/finance-entries", ...staffGuard, async (req, res) => {
  const entries = await prisma.financeEntry.findMany({ where: { restaurantId: req.params.id }, orderBy: { dueDate: "asc" } });
  res.json(entries.map(serializeFinanceEntry));
});

financeRouter.post("/:id/finance-entries", ...staffGuard, async (req, res) => {
  const body = req.body as CreateFinanceEntryRequest;
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (body?.kind !== "payable" && body?.kind !== "receivable") return res.status(400).json({ error: "kind must be payable or receivable" });
  if (!description || description.length > MAX_TEXT_LENGTH) return res.status(400).json({ error: `description is required (max ${MAX_TEXT_LENGTH} characters)` });
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) return res.status(400).json({ error: "amount must be positive" });
  if (!isDate(body.dueDate)) return res.status(400).json({ error: "dueDate must be YYYY-MM-DD" });
  if (body.status !== "pending" && body.status !== "paid") return res.status(400).json({ error: "status must be pending or paid" });
  const category = String(body.category ?? "").slice(0, MAX_TEXT_LENGTH);
  const costCenter = String(body.costCenter ?? "").slice(0, MAX_TEXT_LENGTH);
  const entry = await prisma.financeEntry.create({
    data: {
      restaurantId: req.params.id,
      kind: body.kind,
      description,
      amount: Math.round(body.amount * 100) / 100,
      dueDate: body.dueDate,
      status: body.status,
      category,
      costCenter,
      paidOn: body.status === "paid" ? today() : null
    }
  });
  res.status(201).json(serializeFinanceEntry(entry));
});

financeRouter.post("/:id/finance-entries/:entryId/pay", ...staffGuard, async (req, res) => {
  const { paidOn, paymentMethod } = req.body as { paidOn?: string; paymentMethod?: string };
  if (!isDate(paidOn)) return res.status(400).json({ error: "paidOn must be YYYY-MM-DD" });
  if (!paymentMethod || !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    return res.status(400).json({ error: `paymentMethod must be one of ${PAYMENT_METHODS.join(", ")}` });
  }
  const existing = await prisma.financeEntry.findUnique({ where: { id: req.params.entryId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "entry not found" });
  const entry = await prisma.financeEntry.update({ where: { id: existing.id }, data: { status: "paid", paidOn, paymentMethod } });
  res.json(serializeFinanceEntry(entry));
});

/** Emissão Fiscal queue: finished orders — delivered deliveries and table orders whose comanda is
 *  already closed (a served order at a still-open table isn't billable yet). `total` is what was
 *  charged: table orders include their share of the comanda's service. */
financeRouter.get("/:id/closed-orders", ...staffGuard, async (req, res) => {
  // ponytail: newest 500, add paging when a restaurant outgrows it
  const [orders, openTables] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId: req.params.id, status: { in: ["served", "delivered"] } },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 500
    }),
    prisma.restaurantTable.findMany({ where: { restaurantId: req.params.id, openedAt: { not: null } } })
  ]);
  const stillOpen = (o: (typeof orders)[number]) =>
    o.mode === "table" && openTables.some((t) => t.number === o.tableNumber && o.createdAt >= t.openedAt!);
  res.json(orders.filter((o) => !stillOpen(o)).map((o) => ({ ...serializeOrder(o), total: round2(o.total + serviceFee(o)) })));
});
