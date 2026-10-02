-- OBS-01: an order's history. Each change of state (created, waiting for acceptance, accepted, refused, every move in the
-- Central, the comanda closed with its payment method) is a row, written in the same transaction as the change, with who did
-- it. Nothing reads it yet; no value lives here.
-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channel" TEXT,
    "actor" TEXT NOT NULL,
    "staffId" TEXT,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Like every table in public (9f): no policies, so Supabase's anon and authenticated keys get nothing; the API owns it.
ALTER TABLE "OrderEvent" ENABLE ROW LEVEL SECURITY;
