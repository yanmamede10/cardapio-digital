import { Router } from "express";
import { prisma } from "../db.js";
import { serializeReview, serializeTicket } from "../lib/serialize.js";

export const supportRouter = Router();

supportRouter.get("/:id/tickets", async (req, res) => {
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

supportRouter.patch("/:id/tickets/:ticketId", async (req, res) => {
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

supportRouter.post("/:id/tickets/:ticketId/messages", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
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

supportRouter.get("/:id/reviews", async (req, res) => {
  const reviews = await prisma.review.findMany({ where: { restaurantId: req.params.id }, orderBy: { createdAt: "desc" } });
  res.json(reviews.map(serializeReview));
});

supportRouter.post("/:id/reviews/:reviewId/reply", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
  const existing = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "review not found" });
  const review = await prisma.review.update({
    where: { id: req.params.reviewId },
    data: { reply: text.trim(), repliedAt: new Date() }
  });
  res.json(serializeReview(review));
});
