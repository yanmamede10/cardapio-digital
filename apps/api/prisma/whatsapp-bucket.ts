// Creates (or re-aligns) the private WhatsApp media bucket on Supabase from the constants the API itself uses.
// Runs after the migrations in `npm run db:deploy`; skipped where STORAGE_S3_WHATSAPP_BUCKET is unset.
import { prisma } from "../src/db.js";
import { WHATSAPP_MEDIA_TYPES } from "../src/lib/storage.js";

const bucket = process.env.STORAGE_S3_WHATSAPP_BUCKET;
if (bucket) {
  const types = Object.keys(WHATSAPP_MEDIA_TYPES);
  await prisma.$executeRaw`
    insert into storage.buckets (id, name, public, allowed_mime_types) values (${bucket}, ${bucket}, false, ${types})
    on conflict (id) do update set public = false, allowed_mime_types = excluded.allowed_mime_types`;
  console.log(`Bucket "${bucket}": privado, tipos ${types.join(", ")}`);
}
await prisma.$disconnect();
