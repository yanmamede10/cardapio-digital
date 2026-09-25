import { Router } from "express";
import { LEVEL } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireMinRole, requireStaff } from "../lib/auth.js";
import { serializeReview, serializeTicket } from "../lib/serialize.js";

export const supportRouter = Router();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.
const staffGuard = [requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.ADMINISTRADOR)];
const MAX_MESSAGE_LENGTH = 2000;

supportRouter.get("/:id/tickets", ...staffGuard, async (req, res) => {
  const { status, channel } = req.query as { status?: string; channel?: string };
  const tickets = await prisma.supportTicket.findMany({
    where: {
      restaurantId: req.params.id,
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {})
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { lastActivityAt: "desc" }
  });
  res.json(tickets.map(serializeTicket));
});

supportRouter.patch("/:id/tickets/:ticketId", ...staffGuard, async (req, res) => {
  const { assignee, status } = req.body as { assignee?: string; status?: string };
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "ticket not found" });
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.ticketId },
    data: {
      ...(assignee !== undefined ? { assignee } : {}),
      ...(status !== undefined ? { status } : {}),
      lastActivityAt: new Date()
    },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
  res.json(serializeTicket(ticket));
});

supportRouter.post("/:id/tickets/:ticketId/messages", ...staffGuard, async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
  if (text.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `text must be at most ${MAX_MESSAGE_LENGTH} characters` });
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "ticket not found" });

  await prisma.supportMessage.create({
    data: { ticketId: req.params.ticketId, from: "staff", authorName: null, text: text.trim() }
  });
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.ticketId },
    data: {
      unreadCount: 0,
      status: existing.status === "new" ? "in_progress" : existing.status,
      lastActivityAt: new Date()
    },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
  res.status(201).json(serializeTicket(ticket));
});

supportRouter.get("/:id/reviews", ...staffGuard, async (req, res) => {
  const reviews = await prisma.review.findMany({ where: { restaurantId: req.params.id }, orderBy: { createdAt: "desc" } });
  res.json(reviews.map(serializeReview));
});

supportRouter.post("/:id/reviews/:reviewId/reply", ...staffGuard, async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
  if (text.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `text must be at most ${MAX_MESSAGE_LENGTH} characters` });
  const existing = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "review not found" });
  const review = await prisma.review.update({
    where: { id: req.params.reviewId },
    data: { reply: text.trim(), repliedAt: new Date() }
  });
  res.json(serializeReview(review));
});
