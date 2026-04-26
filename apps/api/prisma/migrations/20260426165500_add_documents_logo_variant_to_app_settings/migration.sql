-- Logo variant for all documents (PDF).
-- Keep idempotent for safe rollouts; backfill from legacy offerLogoVariant.

ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "documentsLogoVariant" TEXT;

UPDATE "app_settings"
SET "documentsLogoVariant" = COALESCE(NULLIF("documentsLogoVariant", ''), NULLIF("offerLogoVariant", ''))
WHERE "documentsLogoVariant" IS NULL OR btrim("documentsLogoVariant") = '';

