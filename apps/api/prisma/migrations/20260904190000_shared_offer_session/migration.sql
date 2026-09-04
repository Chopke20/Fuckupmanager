-- Sesja zewnętrznego edytora oferty (partner Toinen Music).
CREATE TABLE "order_shared_offer_sessions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "partnerPayloadJson" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSavedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_shared_offer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_shared_offer_sessions_orderId_key" ON "order_shared_offer_sessions"("orderId");
CREATE UNIQUE INDEX "order_shared_offer_sessions_publicToken_key" ON "order_shared_offer_sessions"("publicToken");
CREATE INDEX "order_shared_offer_sessions_publicToken_idx" ON "order_shared_offer_sessions"("publicToken");

ALTER TABLE "order_shared_offer_sessions" ADD CONSTRAINT "order_shared_offer_sessions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "shared_offer_session_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_offer_session_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shared_offer_session_events_sessionId_eventType_createdAt_idx"
  ON "shared_offer_session_events"("sessionId", "eventType", "createdAt");

ALTER TABLE "shared_offer_session_events" ADD CONSTRAINT "shared_offer_session_events_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "order_shared_offer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
