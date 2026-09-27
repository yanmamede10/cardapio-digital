-- Comanda membership by order (closedAt) instead of by the table's opening time, which transfers and re-seatings broke.
ALTER TABLE "Order" ADD COLUMN "closedAt" TIMESTAMP(3);

-- Every table order outside a comanda that is open right now was already charged.
UPDATE "Order" o SET "closedAt" = o."updatedAt"
WHERE o."mode" = 'table' AND NOT EXISTS (
  SELECT 1 FROM "RestaurantTable" t
  WHERE t."restaurantId" = o."restaurantId" AND t."number" = o."tableNumber" AND t."openedAt" IS NOT NULL AND o."createdAt" >= t."openedAt"
);
