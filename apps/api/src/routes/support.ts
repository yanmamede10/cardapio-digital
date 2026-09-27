import { Router, type Response } from "express";
import multer from "multer";
import type { SupportTicket } from "@prisma/client";
import { SUPPORT_ROLES } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireRole, requireStaff } from "../lib/auth.js";
import { serializeReview, serializeTicket } from "../lib/serialize.js";
import { storeWhatsAppMedia } from "../lib/storage.js";
import { whatsapp } from "../lib/whatsapp.js";

export const supportRouter = Router();
// Applied per-route (not via router.use) — several routers share the
// "/api/restaurants" mount point, and a path-based router.use() here would
// also run for sibling routers' routes.
const staffGuard = [requireStaff, requireOwnRestaurant, requireRole(...SUPPORT_ROLES)];
const MAX_MESSAGE_LENGTH = 2000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } }); // WhatsApp's own media cap

/** Sends through the WhatsApp provider. On failure it answers the request (503/502) and returns null: nothing is recorded as sent. */
async function viaWhatsApp(res: Response, send: () => Promise<string>): Promise<string | null> {
  if (!whatsapp.configured) {
    res.status(503).json({ error: "WhatsApp is not configured on this server" });
    return null;
  }
  try {
    return await send();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "WhatsApp did not send the message" });
    return null;
  }
}

/** After a staff reply: nothing left unread, a new ticket is now being handled. */
function staffReplied(t: SupportTicket) {
  return prisma.supportTicket.update({
    where: { id: t.id },
    data: { unreadCount: 0, status: t.status === "new" ? "in_progress" : t.status, lastActivityAt: new Date() },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
}

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
  res.json(await Promise.all(tickets.map(serializeTicket)));
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
  res.json(await serializeTicket(ticket));
});

supportRouter.post("/:id/tickets/:ticketId/messages", ...staffGuard, async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
  if (text.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `text must be at most ${MAX_MESSAGE_LENGTH} characters` });
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "ticket not found" });

  // WhatsApp goes out first: a message that didn't reach the customer is never shown as sent.
  let externalId: string | null = null;
  if (existing.channel === "whatsapp") {
    externalId = await viaWhatsApp(res, () => whatsapp.sendText(existing.restaurantId, existing.contactPhone!, text.trim()));
    if (!externalId) return;
  }
  await prisma.supportMessage.create({
    data: { ticketId: req.params.ticketId, from: "staff", authorName: null, text: text.trim(), externalId }
  });
  res.status(201).json(await serializeTicket(await staffReplied(existing)));
});

// Image (upload) or voice note (recorded in the browser) — WhatsApp conversations only.
supportRouter.post("/:id/tickets/:ticketId/media", ...staffGuard, upload.single("file"), async (req, res) => {
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!existing || existing.restaurantId !== req.params.id) return res.status(404).json({ error: "ticket not found" });
  if (existing.channel !== "whatsapp" || !existing.contactPhone) return res.status(400).json({ error: "media replies are only for WhatsApp conversations" });
  const file = req.file;
  const kind = file?.mimetype.startsWith("image/") ? "image" : file?.mimetype.startsWith("audio/") ? "audio" : null;
  if (!file || !kind) return res.status(400).json({ error: "file must be an image or an audio recording" });

  let mediaKey: string;
  try {
    mediaKey = await storeWhatsAppMedia(existing.restaurantId, file.buffer, file.mimetype);
  } catch (err) {
    console.error(err);
    return res.status(503).json({ error: "file storage is not configured" });
  }
  const externalId = await viaWhatsApp(res, () => whatsapp.sendMedia(existing.restaurantId, existing.contactPhone!, { kind, mimetype: file.mimetype, base64: file.buffer.toString("base64") }));
  if (!externalId) return;
  await prisma.supportMessage.create({ data: { ticketId: existing.id, from: "staff", authorName: null, text: "", mediaType: kind, mediaKey, externalId } });
  res.status(201).json(await serializeTicket(await staffReplied(existing)));
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
