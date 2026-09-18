import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET || !PUBLIC_URL) {
    throw new Error("R2 storage is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY }
    });
  }
  return client;
}

/** Uploads a file to the R2 bucket and returns its public URL. */
export async function uploadPublicFile(params: { buffer: Buffer; contentType: string; folder: string; extension: string }): Promise<string> {
  const key = `${params.folder}/${randomUUID()}.${params.extension}`;
  await getClient().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: params.buffer, ContentType: params.contentType }));
  return `${PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}
