-- Per-company project contact shown in PDF footer ("Opiekun projektu").
-- Keep idempotent for safe rollouts.

ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "projectContactName" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "projectContactPhone" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "projectContactEmail" TEXT;

