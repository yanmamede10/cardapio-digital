-- WhatsApp no Atendimento: aceite do aviso (Restaurant), contato do ticket e mídia/id externo da mensagem.
ALTER TABLE "Restaurant" ADD COLUMN "whatsappTermsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "whatsappTermsAcceptedBy" TEXT;

ALTER TABLE "SupportTicket" ADD COLUMN "contactPhone" TEXT;

ALTER TABLE "SupportMessage" ADD COLUMN "mediaType" TEXT,
ADD COLUMN "mediaUrl" TEXT,
ADD COLUMN "externalId" TEXT;

-- NULLs never collide, so Mesa/Delivery tickets and messages without an external id are unaffected.
CREATE UNIQUE INDEX "SupportTicket_restaurantId_contactPhone_key" ON "SupportTicket"("restaurantId", "contactPhone");
CREATE UNIQUE INDEX "SupportMessage_ticketId_externalId_key" ON "SupportMessage"("ticketId", "externalId");
