import { asyncRouter } from "../lib/router.js";
import { Prisma } from "@prisma/client";
import { LEVEL, SUPPORT_ROLES, type WhatsAppStatus } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireMinRole, requireModule, requireOwnRestaurant, requireRole, requireStaff } from "../lib/auth.js";
import { storeWhatsAppMedia } from "../lib/storage.js";
import { whatsapp, type WhatsAppMessage } from "../lib/whatsapp.js";

// Configurações → WhatsApp is Dono-only; the connection indicator is for everyone who sees Atendimento.
export const whatsappRouter = asyncRouter();
const supportGuard = [requireStaff, requireOwnRestaurant, requireRole(...SUPPORT_ROLES), requireModule("atendimento")];
const ownerGuard = [requireStaff, requireOwnRestaurant, requireMinRole(LEVEL.DONO), requireModule("atendimento")];

export async function statusOf(restaurantId: string): Promise<WhatsAppStatus> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { whatsappTermsAcceptedAt: true, whatsappTermsAcceptedBy: true } });
  if (!r?.whatsappTermsAcceptedAt) return { state: "disconnected", termsAcceptedAt: null, termsAcceptedBy: null };
  const by = r.whatsappTermsAcceptedBy ? await prisma.staffMember.findUnique({ where: { id: r.whatsappTermsAcceptedBy }, select: { name: true } }) : null;
  // Provider unreachable counts as disconnected: the indicator exists so the restaurant never stops receiving in silence.
  const state = await whatsapp.status(restaurantId).catch(() => "disconnected" as const);
  return { state, termsAcceptedAt: r.whatsappTermsAcceptedAt.toISOString(), termsAcceptedBy: by?.name ?? null };
}

whatsappRouter.get("/:id/whatsapp", ...supportGuard, async (req, res) => {
  res.json(await statusOf(req.params.id));
});

// The "not official, the number can be banned" notice. The first acceptance is the record — accepting again keeps who/when.
whatsappRouter.post("/:id/whatsapp/terms", ...ownerGuard, async (req, res) => {
  await prisma.restaurant.updateMany({
    where: { id: req.params.id, whatsappTermsAcceptedAt: null },
    data: { whatsappTermsAcceptedAt: new Date(), whatsappTermsAcceptedBy: req.staff!.staffId }
  });
  res.json(await statusOf(req.params.id));
});

// Polled by the settings screen while the QR is up: each call returns the current QR, then "connected" once scanned.
whatsappRouter.post("/:id/whatsapp/connect", ...ownerGuard, async (req, res) => {
  if (!whatsapp.configured) return res.status(503).json({ error: "WhatsApp is not configured on this server" });
  const r = await prisma.restaurant.findUnique({ where: { id: req.params.id }, select: { whatsappTermsAcceptedAt: true } });
  if (!r?.whatsappTermsAcceptedAt) return res.status(409).json({ error: "accept the WhatsApp notice first" });
  try {
    res.json(await whatsapp.connect(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "WhatsApp provider unavailable" });
  }
});

whatsappRouter.post("/:id/whatsapp/disconnect", ...ownerGuard, async (req, res) => {
  if (!whatsapp.configured) return res.status(503).json({ error: "WhatsApp is not configured on this server" });
  try {
    await whatsapp.disconnect(req.params.id);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "WhatsApp provider unavailable" });
  }
  res.json(await statusOf(req.params.id));
});

// Provider → API. Authenticated by the provider's own check (a shared secret header for Evolution); receiving never sends anything.
export const whatsappWebhookRouter = asyncRouter();

whatsappWebhookRouter.post("/", async (req, res, next) => {
  if (!whatsapp.verifyWebhook((name) => req.header(name))) return res.status(401).json({ error: "invalid webhook secret" });
  try {
    for (const m of whatsapp.parseWebhook(req.body)) await receive(m);
    res.json({ ok: true });
  } catch (err) {
    next(err); // 500 → Evolution retries; the externalId check makes the retry harmless
  }
});

/** One ticket per contact per restaurant, forever: a resolved one is reopened, so the whole history stays in one thread. */
async function ticketFor(m: WhatsAppMessage) {
  const label = m.phone.includes("@") ? "número oculto" : `+${m.phone}`;
  const args = {
    where: { restaurantId_contactPhone: { restaurantId: m.restaurantId, contactPhone: m.phone } },
    create: { restaurantId: m.restaurantId, channel: "whatsapp", contactPhone: m.phone, customerName: (!m.fromMe && m.pushName) || label, refLabel: `WhatsApp · ${label}` },
    update: {}
  };
  try {
    return await prisma.supportTicket.upsert(args);
  } catch (err) {
    // A new contact's first messages can arrive at once; whoever loses the insert race reads the winner's row.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return prisma.supportTicket.upsert(args);
    throw err;
  }
}

/** A customer's message, or one typed on the restaurant's own phone (fromMe: a manual reply or WhatsApp Business' greeting) —
 *  both land in the same conversation so nobody answers twice. */
async function receive(m: WhatsAppMessage) {
  const r = await prisma.restaurant.findUnique({ where: { id: m.restaurantId }, select: { whatsappTermsAcceptedAt: true } });
  if (!r?.whatsappTermsAcceptedAt) return; // not a restaurant that set WhatsApp up

  const ticket = await ticketFor(m);
  const key = { ticketId_externalId: { ticketId: ticket.id, externalId: m.externalId } };
  if (await prisma.supportMessage.findUnique({ where: key })) return; // redelivered webhook

  let mediaKey: string | null = null;
  if (m.media) {
    // A failed upload must not lose the message itself: it's kept with a note to check the phone.
    mediaKey = await storeWhatsAppMedia(m.restaurantId, Buffer.from(m.media.base64, "base64"), m.media.mimetype).catch((err) => (console.error(err), null));
  }
  const lost = m.media && !mediaKey ? `[${m.media.kind === "image" ? "Imagem" : "Áudio"} — não foi possível salvar, veja no celular] ` : "";
  const { count } = await prisma.supportMessage.createMany({
    skipDuplicates: true, // the same redelivery, racing the check above
    data: [
      {
        ticketId: ticket.id,
        from: m.fromMe ? "staff" : "customer",
        authorName: m.fromMe ? "Celular do restaurante" : null,
        text: (lost + m.text).trim(),
        mediaType: mediaKey ? m.media!.kind : null,
        mediaKey,
        externalId: m.externalId
      }
    ]
  });
  if (!count) return;

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: m.fromMe
      ? { unreadCount: 0, status: ticket.status === "new" ? "in_progress" : ticket.status, lastActivityAt: new Date() } // = answering in Atendimento
      : { unreadCount: { increment: 1 }, status: ticket.status === "resolved" ? "new" : ticket.status, lastActivityAt: new Date(), ...(m.pushName ? { customerName: m.pushName } : {}) }
  });
}
