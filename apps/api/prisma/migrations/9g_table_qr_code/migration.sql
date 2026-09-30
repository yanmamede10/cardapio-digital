-- A table's QR carried "<restaurant>.<number>": anyone could type another table's code and order for it. Each table now has
-- its own code: 244 random bits (two gen_random_uuid(), which use pg_strong_random) in base64url, 43 characters. The default
-- covers new tables and, being volatile, gives each existing row its own code right here. "Gerar novo QR" sets it back to
-- DEFAULT, and the old code stops resolving at once.
ALTER TABLE "RestaurantTable" ADD COLUMN "qrCode" TEXT NOT NULL DEFAULT translate(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/=', '-_');
CREATE UNIQUE INDEX "RestaurantTable_qrCode_key" ON "RestaurantTable"("qrCode");
