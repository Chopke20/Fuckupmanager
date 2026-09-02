-- AlterTable
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "stagePlanKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_stagePlanKey_key" ON "equipment"("stagePlanKey");
