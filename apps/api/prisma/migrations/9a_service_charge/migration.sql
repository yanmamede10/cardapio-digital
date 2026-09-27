-- The table's 10% service is the restaurant's choice (Configurações → Financeiro). On by default: nothing changes for anyone.
ALTER TABLE "Restaurant" ADD COLUMN "serviceCharge" BOOLEAN NOT NULL DEFAULT true;
