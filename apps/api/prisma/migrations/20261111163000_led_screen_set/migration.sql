-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ledScreenJson" TEXT;

-- AlterTable
ALTER TABLE "order_offer_blocks" ADD COLUMN IF NOT EXISTS "ledScreenJson" TEXT;

-- AlterTable
ALTER TABLE "led_screen_projects" ADD COLUMN IF NOT EXISTS "screenSetId" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "led_screen_projects_orderId_offerBlockId_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "led_screen_projects_orderId_offerBlockId_screenSetId_idx" ON "led_screen_projects"("orderId", "offerBlockId", "screenSetId");
