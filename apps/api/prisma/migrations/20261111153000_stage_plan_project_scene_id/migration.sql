-- Multiple stage scenes per offer block: projects keyed by sceneId too.
ALTER TABLE "stage_plan_projects" ADD COLUMN IF NOT EXISTS "sceneId" TEXT;

DROP INDEX IF EXISTS "stage_plan_projects_orderId_offerBlockId_idx";

CREATE INDEX IF NOT EXISTS "stage_plan_projects_orderId_offerBlockId_sceneId_idx"
  ON "stage_plan_projects"("orderId", "offerBlockId", "sceneId");
