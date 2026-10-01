// Creates (or re-aligns) the two Supabase Storage buckets from the constants the API itself uses, so every project —
// production included — comes out the same: public or private, size limit and accepted types. Runs after the migrations in
// `npm run db:deploy`; a bucket whose variable is unset (plain Postgres, the tests) is skipped.
import { prisma } from "../src/db.js";
import { PUBLIC_IMAGE_MAX_BYTES, PUBLIC_IMAGE_TYPES, WHATSAPP_MEDIA_MAX_BYTES, WHATSAPP_MEDIA_TYPES } from "../src/lib/storage.js";

const buckets: [id: string | undefined, isPublic: boolean, maxBytes: number, types: string[]][] = [
  [process.env.STORAGE_S3_BUCKET, true, PUBLIC_IMAGE_MAX_BYTES, PUBLIC_IMAGE_TYPES], // logo, capa, fotos dos pratos
  [process.env.STORAGE_S3_WHATSAPP_BUCKET, false, WHATSAPP_MEDIA_MAX_BYTES, Object.keys(WHATSAPP_MEDIA_TYPES)] // fotos e áudios do WhatsApp
];
for (const [id, isPublic, maxBytes, types] of buckets) {
  if (!id) continue;
  await prisma.$executeRaw`
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (${id}, ${id}, ${isPublic}, ${maxBytes}, ${types})
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types`;
  console.log(`Bucket "${id}": ${isPublic ? "público" : "privado"}, até ${maxBytes / 1024 / 1024} MB, tipos ${types.join(", ")}`);
}
await prisma.$disconnect();
