-- What each order line takes from stock, frozen when ordered (closing used to read the ficha técnica of that moment).
-- Lines already there stay null and keep the old behavior.
ALTER TABLE "OrderLine" ADD COLUMN "stockJson" TEXT;
