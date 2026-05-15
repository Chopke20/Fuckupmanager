-- Bloki oferty (nazwane grupy sprzęt + produkcja + transport)
CREATE TABLE "order_offer_blocks" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_offer_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_offer_blocks_orderId_sortOrder_idx" ON "order_offer_blocks"("orderId", "sortOrder");

ALTER TABLE "order_offer_blocks" ADD CONSTRAINT "order_offer_blocks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_equipment_items" ADD COLUMN "offerBlockId" TEXT;
ALTER TABLE "order_production_items" ADD COLUMN "offerBlockId" TEXT;

CREATE INDEX "order_equipment_items_offerBlockId_idx" ON "order_equipment_items"("offerBlockId");
CREATE INDEX "order_production_items_offerBlockId_idx" ON "order_production_items"("offerBlockId");

ALTER TABLE "order_equipment_items" ADD CONSTRAINT "order_equipment_items_offerBlockId_fkey" FOREIGN KEY ("offerBlockId") REFERENCES "order_offer_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_production_items" ADD CONSTRAINT "order_production_items_offerBlockId_fkey" FOREIGN KEY ("offerBlockId") REFERENCES "order_offer_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
