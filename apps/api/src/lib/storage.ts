import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// S3-compatible object storage. Points at Supabase Storage's S3 endpoint
// (Project Settings → Storage → S3 Connection), but works with any S3-compatible
// provider (R2, MinIO, ...) since only the endpoint/region change.
const ENDPOINT = process.env.STORAGE_S3_ENDPOINT;
const REGION = process.env.STORAGE_S3_REGION || "us-east-1";
const ACCESS_KEY_ID = process.env.STORAGE_S3_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.STORAGE_S3_SECRET_ACCESS_KEY;
const BUCKET = process.env.STORAGE_S3_BUCKET;
const PUBLIC_URL = process.env.STORAGE_PUBLIC_URL;

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET || !PUBLIC_URL) {
    throw new Error(
      "object storage is not configured — set STORAGE_S3_ENDPOINT, STORAGE_S3_ACCESS_KEY_ID, STORAGE_S3_SECRET_ACCESS_KEY, STORAGE_S3_BUCKET and STORAGE_PUBLIC_URL"
    );
  }
  if (!client) {
    client = new S3Client({ region: REGION, endpoint: ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY } });
  }
  return client;
}

/** Uploads a file to the configured public bucket and returns its public URL. */
export async function uploadPublicFile(params: { buffer: Buffer; contentType: string; folder: string; extension: string }): Promise<string> {
  const key = `${params.folder}/${randomUUID()}.${params.extension}`;
  await getClient().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: params.buffer, ContentType: params.contentType }));
  return `${PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}
