import type { WhatsAppState } from "@cardapio/shared";
import { EvolutionProvider } from "./evolution.js";

export interface WhatsAppMedia {
  kind: "image" | "audio";
  mimetype: string;
  base64: string;
}

/** A message on the restaurant's number: from a customer, or typed on the restaurant's own phone (fromMe). */
export interface WhatsAppMessage {
  restaurantId: string;
  externalId: string;
  phone: string; // digits (5511999990000); a bare WhatsApp id ("…@lid") when the number is hidden
  fromMe: boolean;
  pushName: string | null;
  text: string;
  /** What the message says about its photo or voice note — the size it declares, null if none. The bytes themselves come
   *  from downloadMedia, only when they fit. */
  media: { kind: "image" | "audio"; mimetype: string; bytes: number | null } | null;
}

/**
 * The only door to WhatsApp — tickets, routes and screens never talk to a provider directly.
 * One connection per restaurant, addressed by restaurant id. Today: Evolution API (unofficial, Baileys).
 * Meta's Cloud API goes in as a second class implementing this, swapped on the `whatsapp` line below.
 */
export interface WhatsAppProvider {
  /** Env vars set; false → the routes answer 503. */
  readonly configured: boolean;
  /** Starts (or resumes) linking the restaurant's number. qr = PNG data URL to scan, null once connected or while it's generated. */
  connect(restaurantId: string): Promise<{ state: WhatsAppState; qr: string | null }>;
  status(restaurantId: string): Promise<WhatsAppState>;
  disconnect(restaurantId: string): Promise<void>;
  /** Each send returns the provider's message id. Only ever called from a staff request — never on its own. */
  sendText(restaurantId: string, phone: string, text: string): Promise<string>;
  sendMedia(restaurantId: string, phone: string, media: WhatsAppMedia): Promise<string>;
  /** Read receipts ("visto") for these incoming messages. Only after a reply from Atendimento went out — never on receiving or opening. */
  markRead(restaurantId: string, phone: string, messageIds: string[]): Promise<void>;
  /** The bytes of a received message's media (WhatsAppMessage.media), fetched from the provider. */
  downloadMedia(restaurantId: string, messageId: string): Promise<Buffer>;
  /** Webhook: is this request really from the provider? */
  verifyWebhook(header: (name: string) => string | undefined): boolean;
  /** Webhook body → messages worth a ticket (groups, reactions, receipts etc. are dropped). */
  parseWebhook(body: unknown): WhatsAppMessage[];
}

export const whatsapp: WhatsAppProvider = new EvolutionProvider();
