-- The 10% service charged on each table order, frozen when its comanda closes: Emissão Fiscal used to re-read today's
-- setting. Comandas already closed keep the number the queue was showing (today's setting, rounded like round2 in JS).
ALTER TABLE "Order" ADD COLUMN "service" DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "Order" o SET "service" = floor(o."subtotal" * 0.1 * 100 + 0.5) / 100
FROM "Restaurant" r
WHERE r."id" = o."restaurantId" AND r."serviceCharge" AND o."mode" = 'table' AND o."closedAt" IS NOT NULL;
