import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible object storage. Points at Supabase Storage's S3 endpoint
// (Project Settings → Storage → S3 Connection), but works with any S3-compatible
// provider (R2, MinIO, ...) since only the endpoint/region change.
// Two buckets: STORAGE_S3_BUCKET is public (logo, cover, product photos — the cardápio shows them);
// STORAGE_S3_WHATSAPP_BUCKET is private (customers' WhatsApp photos and voice notes), read only through signed URLs.
const ENDPOINT = process.env.STORAGE_S3_ENDPOINT;
const REGION = process.env.STORAGE_S3_REGION || "us-east-1";
const ACCESS_KEY_ID = process.env.STORAGE_S3_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.STORAGE_S3_SECRET_ACCESS_KEY;
const BUCKET = process.env.STORAGE_S3_BUCKET;
const PUBLIC_URL = process.env.STORAGE_PUBLIC_URL;
const WHATSAPP_BUCKET = process.env.STORAGE_S3_WHATSAPP_BUCKET;

/** What the WhatsApp bucket takes (MIME type → file extension) and up to what size (WhatsApp's own cap for voice notes).
 *  The one definition: the API's upload limit and prisma/whatsapp-bucket.ts (the bucket's allow-list and size limit) read these. */
export const WHATSAPP_MEDIA_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/webm": "webm" };
export const WHATSAPP_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

// Signed URLs are signed at the start of the current 30-min window and live 60 min: each one works for 30–60 min after
// it's handed out. Atendimento re-reads its tickets every few seconds, so it always holds a live one, and the fixed window
// keeps the URL identical between reads (no photo re-download, no voice note restarting mid-play). A leaked link dies within the hour.
const SIGN_WINDOW_MS = 30 * 60_000;

let client: S3Client | null = null;

function clientFor(bucket: string | undefined): S3Client {
  if (!ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !bucket) {
    throw new Error("object storage is not configured — set STORAGE_S3_ENDPOINT, STORAGE_S3_ACCESS_KEY_ID, STORAGE_S3_SECRET_ACCESS_KEY and the bucket");
  }
  client ??= new S3Client({ region: REGION, endpoint: ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY } });
  return client;
}

async function put(bucket: string | undefined, params: { buffer: Buffer; contentType: string; folder: string; extension: string }): Promise<string> {
  const key = `${params.folder}/${randomUUID()}.${params.extension}`;
  await clientFor(bucket).send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: params.buffer, ContentType: params.contentType }));
  return key;
}

/** Uploads a file to the configured public bucket and returns its public URL. */
export async function uploadPublicFile(params: { buffer: Buffer; contentType: string; folder: string; extension: string }): Promise<string> {
  if (!PUBLIC_URL) throw new Error("object storage is not configured — set STORAGE_PUBLIC_URL");
  return `${PUBLIC_URL.replace(/\/$/, "")}/${await put(BUCKET, params)}`;
}

/** A WhatsApp photo or voice note → the private bucket. Returns the object key, never a URL: it's read back via signedMediaUrl. */
export function storeWhatsAppMedia(restaurantId: string, buffer: Buffer, mimetype: string) {
  // Bare type: WhatsApp voice notes come as "audio/ogg; codecs=opus", Chrome records "audio/webm;codecs=opus" — and Supabase
  // matches the bucket's allowed MIME types against the whole subtype, so the parameter alone gets the upload refused.
  const type = mimetype.split(";")[0].trim();
  return put(WHATSAPP_BUCKET, { buffer, contentType: type, folder: restaurantId, extension: WHATSAPP_MEDIA_TYPES[type] ?? "bin" });
}

export function signedMediaUrl(key: string): Promise<string> {
  const signingDate = new Date(Math.floor(Date.now() / SIGN_WINDOW_MS) * SIGN_WINDOW_MS);
  return getSignedUrl(clientFor(WHATSAPP_BUCKET), new GetObjectCommand({ Bucket: WHATSAPP_BUCKET, Key: key }), { expiresIn: (2 * SIGN_WINDOW_MS) / 1000, signingDate });
}
