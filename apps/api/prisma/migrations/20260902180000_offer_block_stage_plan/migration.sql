-- AlterTable
ALTER TABLE "order_offer_blocks" ADD COLUMN IF NOT EXISTS "stagePlanJson" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "stage_plan_projects_orderId_key";

-- AlterTable
ALTER TABLE "stage_plan_projects" ADD COLUMN IF NOT EXISTS "offerBlockId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_plan_projects_orderId_offerBlockId_idx" ON "stage_plan_projects"("orderId", "offerBlockId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stage_plan_projects_offerBlockId_fkey'
  ) THEN
    ALTER TABLE "stage_plan_projects"
      ADD CONSTRAINT "stage_plan_projects_offerBlockId_fkey"
      FOREIGN KEY ("offerBlockId") REFERENCES "order_offer_blocks"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
