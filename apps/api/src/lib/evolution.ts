import { timingSafeEqual } from "node:crypto";
import type { WhatsAppState } from "@cardapio/shared";
import type { WhatsAppMedia, WhatsAppMessage, WhatsAppProvider } from "./whatsapp.js";

// Evolution API v2 (checked against v2.3.7 — see docker-compose.yml), Baileys channel. Instance name = restaurant id.
// Dev only for now: nothing here is configured on Vercel, so there every WhatsApp route answers 503.
const BASE = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
const KEY = process.env.EVOLUTION_API_KEY;
const WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL;
const SECRET = process.env.WHATSAPP_WEBHOOK_SECRET;
const SECRET_HEADER = "x-webhook-secret";

const STATE: Record<string, WhatsAppState> = { open: "connected", connecting: "connecting" };
// Kinds we don't show still leave a note in the conversation, so nothing arrives unseen. Anything else (reactions, edits, receipts) is dropped.
const NOTE: Record<string, string> = { imageMessage: "Imagem", audioMessage: "Áudio", videoMessage: "Vídeo", documentMessage: "Documento", stickerMessage: "Figurinha", locationMessage: "Localização", contactMessage: "Contato" };

type Sent = { key: { id: string } };
interface Upsert {
  event?: string;
  instance?: string;
  data?: {
    key?: { id?: string; remoteJid?: string; fromMe?: boolean };
    pushName?: string;
    messageType?: string;
    message?: {
      conversation?: string; // Evolution folds extendedTextMessage into this
      imageMessage?: { caption?: string; mimetype?: string };
      audioMessage?: { mimetype?: string };
      base64?: string; // media bytes — the instance's webhook is created with base64: true
    };
  };
}

export class EvolutionProvider implements WhatsAppProvider {
  readonly configured = Boolean(BASE && KEY && WEBHOOK_URL && SECRET);

  private async call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
    if (!this.configured) throw new Error("Evolution is not configured");
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { apikey: KEY!, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000)
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  /** call(), but non-2xx — or Evolution's 200 with { error: true } — throws. */
  private async ok<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await this.call<T & { error?: unknown }>(method, path, body);
    if (r.status >= 300 || r.body?.error === true) throw new Error(`Evolution ${method} ${path} → ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    return r.body;
  }

  async connect(restaurantId: string) {
    const name = encodeURIComponent(restaurantId);
    if ((await this.call("GET", `/instance/connectionState/${name}`)).status === 404) {
      await this.ok("POST", "/instance/create", {
        instanceName: restaurantId,
        integration: "WHATSAPP-BAILEYS",
        qrcode: false,
        // Leave the restaurant's phone as it was: always-online would mute its notifications, no auto read receipts,
        // calls untouched, no history import. Groups ignored — only 1:1 chats become tickets.
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        rejectCall: false,
        syncFullHistory: false,
        groupsIgnore: true,
        webhook: { enabled: true, url: WEBHOOK_URL, headers: { [SECRET_HEADER]: SECRET }, byEvents: false, base64: true, events: ["MESSAGES_UPSERT"] }
      });
    }
    // close → starts a session (first QR may take a moment); connecting → the current QR; open → just the state.
    const r = await this.ok<{ instance?: { state?: string }; base64?: string }>("GET", `/instance/connect/${name}`);
    return r.instance?.state === "open" ? { state: "connected" as const, qr: null } : { state: "connecting" as const, qr: r.base64 ?? null };
  }

  async status(restaurantId: string): Promise<WhatsAppState> {
    const r = await this.call<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${encodeURIComponent(restaurantId)}`);
    if (r.status === 404) return "disconnected";
    if (r.status >= 300) throw new Error(`Evolution connectionState → ${r.status}`);
    return STATE[r.body.instance?.state ?? ""] ?? "disconnected";
  }

  async disconnect(restaurantId: string) {
    // Delete, not logout: works in any state (even mid-QR), and the next connect() recreates it with the current webhook config.
    const r = await this.call("DELETE", `/instance/delete/${encodeURIComponent(restaurantId)}`);
    if (r.status >= 300 && r.status !== 404) throw new Error(`Evolution delete → ${r.status}`);
  }

  async sendText(restaurantId: string, phone: string, text: string) {
    return (await this.ok<Sent>("POST", `/message/sendText/${encodeURIComponent(restaurantId)}`, { number: phone, text })).key.id;
  }

  async sendMedia(restaurantId: string, phone: string, media: WhatsAppMedia) {
    const name = encodeURIComponent(restaurantId);
    // Voice note: Evolution converts whatever the browser recorded (webm/mp4/ogg) to ogg/opus PTT with its bundled ffmpeg
    // (sendWhatsAppAudio's `encoding` defaults to true). Images go through its sharp → JPEG.
    const sent =
      media.kind === "audio"
        ? await this.ok<Sent>("POST", `/message/sendWhatsAppAudio/${name}`, { number: phone, audio: media.base64 })
        : await this.ok<Sent>("POST", `/message/sendMedia/${name}`, { number: phone, mediatype: "image", mimetype: media.mimetype, media: media.base64 });
    return sent.key.id;
  }

  verifyWebhook(header: (name: string) => string | undefined) {
    const got = Buffer.from(header(SECRET_HEADER) ?? "");
    const want = Buffer.from(SECRET ?? "");
    return want.length > 0 && got.length === want.length && timingSafeEqual(got, want);
  }

  parseWebhook(body: unknown): WhatsAppMessage[] {
    const { event, instance, data } = (body ?? {}) as Upsert;
    // 1:1 chats only: "@s.whatsapp.net" is a phone number; "@lid" a hidden one Evolution couldn't map back (sendable as is).
    const jid = data?.key?.remoteJid ?? "";
    const phone = jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : jid.endsWith("@lid") ? jid : null;
    if (event !== "messages.upsert" || !instance || !data?.key?.id || !phone) return [];

    const m = data.message ?? {};
    const kind = m.imageMessage ? "image" : m.audioMessage ? "audio" : null;
    const mimetype = (m.imageMessage ?? m.audioMessage)?.mimetype ?? (kind === "image" ? "image/jpeg" : "audio/ogg");
    const media: WhatsAppMedia | null = kind && m.base64 ? { kind, mimetype, base64: m.base64 } : null;
    const note = NOTE[data.messageType ?? ""];
    const text = m.conversation || m.imageMessage?.caption || (media ? "" : note ? `[${note} — veja no celular]` : null);
    if (text === null) return [];

    return [
      {
        restaurantId: instance,
        externalId: data.key.id,
        phone,
        fromMe: Boolean(data.key.fromMe),
        pushName: data.pushName || null,
        text,
        media
      }
    ];
  }
}
