-- "Para levar": a table order (QR or tablet) the customer takes away. It stays on the table's comanda like any order (and in
-- the service's base); the Central and the kitchen see it flagged.
ALTER TABLE "Order" ADD COLUMN "takeaway" BOOLEAN NOT NULL DEFAULT false;
