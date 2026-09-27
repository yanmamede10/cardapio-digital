-- Mensalidades (super admin): a due day instead of one fixed due date, and a BillingCharge per month
-- ("2026-09", null for other charges) with when/how it was paid. "Atrasado" is computed, never stored.
ALTER TABLE "Restaurant" ADD COLUMN "planDueDay" INTEGER NOT NULL DEFAULT 10;
UPDATE "Restaurant" SET "planDueDay" = LEAST(28, EXTRACT(DAY FROM "planDueDate")::INTEGER) WHERE "planDueDate" IS NOT NULL;
ALTER TABLE "Restaurant" DROP COLUMN "planDueDate";

ALTER TABLE "BillingCharge" ADD COLUMN "month" TEXT,
ADD COLUMN "paidOn" TEXT,
ADD COLUMN "paymentMethod" TEXT;
CREATE UNIQUE INDEX "BillingCharge_restaurantId_month_key" ON "BillingCharge"("restaurantId", "month");
