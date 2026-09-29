-- Configurações → Salão: whether customers order through the table's QR. On by default: nothing changes until it's turned off.
ALTER TABLE "Restaurant" ADD COLUMN "qrOrdering" BOOLEAN NOT NULL DEFAULT true;
