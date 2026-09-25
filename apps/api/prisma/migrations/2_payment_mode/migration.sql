-- paymentMode was added to the schema with `db push`, so no migration created it.
-- IF NOT EXISTS: a no-op on databases that already have it (Supabase), creates it on fresh ones (tests).
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT NOT NULL DEFAULT 'maquininha_propria';
