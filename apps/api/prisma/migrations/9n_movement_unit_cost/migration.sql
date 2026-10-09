-- Item 3 (pendência do J): the cost is locked after the first stock movement, like the unit; a wrong cost is corrected in
-- Ajustar estoque, and the movement records the cost it set (null: it did not touch the cost).
ALTER TABLE "StockMovement" ADD COLUMN "unitCost" DOUBLE PRECISION;
