-- CreateTable
CREATE TABLE IF NOT EXISTS "stage_plan_role_maps" (
    "id" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "equipmentId" TEXT,
    "attachToRoleKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_plan_role_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stage_plan_role_maps_roleKey_key" ON "stage_plan_role_maps"("roleKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_plan_role_maps_equipmentId_idx" ON "stage_plan_role_maps"("equipmentId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "stage_plan_role_maps"
    ADD CONSTRAINT "stage_plan_role_maps_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Migrate existing Equipment.stagePlanKey → role maps (map action)
INSERT INTO "stage_plan_role_maps" ("id", "roleKey", "action", "equipmentId", "attachToRoleKey", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."stagePlanKey", 'map', e."id", NULL, NOW(), NOW()
FROM "equipment" e
WHERE e."stagePlanKey" IS NOT NULL
  AND e."stagePlanKey" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "stage_plan_role_maps" m WHERE m."roleKey" = e."stagePlanKey"
  );

-- DropIndex
DROP INDEX IF EXISTS "equipment_stagePlanKey_key";

-- AlterTable
ALTER TABLE "equipment" DROP COLUMN IF EXISTS "stagePlanKey";
