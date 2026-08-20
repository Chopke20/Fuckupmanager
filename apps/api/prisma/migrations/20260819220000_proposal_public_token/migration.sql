-- Publiczny token i sygnały klienta dla snapshotu proposal (przypięta wersja).
ALTER TABLE "order_document_exports" ADD COLUMN "publicToken" TEXT;
ALTER TABLE "order_document_exports" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "order_document_exports" ADD COLUMN "clientSignalsJson" TEXT;

CREATE UNIQUE INDEX "order_document_exports_publicToken_key" ON "order_document_exports"("publicToken");

CREATE TABLE "proposal_public_events" (
    "id" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_public_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proposal_public_events_exportId_eventType_createdAt_idx" ON "proposal_public_events"("exportId", "eventType", "createdAt");

ALTER TABLE "proposal_public_events" ADD CONSTRAINT "proposal_public_events_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "order_document_exports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
