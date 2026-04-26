-- Add warehouse headquarters address used as origin for Google Distance Matrix.
-- Keep idempotent for safe rollouts.

ALTER TABLE "app_settings"
ADD COLUMN IF NOT EXISTS "warehouseAddress" TEXT;

