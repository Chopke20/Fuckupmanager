-- Logo placement variants (choose DARK/LIGHT per context; NULL = do not show).
-- Keep idempotent for safe rollouts.

ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "sidebarLogoVariant" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "loginLogoVariant" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "offerLogoVariant" TEXT;

