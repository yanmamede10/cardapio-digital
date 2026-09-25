-- ADMIN-01: platform status, contact and sign-up date. Restaurants that already exist are live → "ativo".
ALTER TABLE "Restaurant" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ativo',
ADD COLUMN "contact" TEXT NOT NULL DEFAULT '',
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
