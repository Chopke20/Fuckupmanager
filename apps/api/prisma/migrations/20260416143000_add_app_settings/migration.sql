-- NOTE:
-- A previous production rollout might have created "app_settings" already.
-- Use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS to keep this migration safe.

CREATE TABLE IF NOT EXISTS "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "brandName" TEXT NOT NULL DEFAULT 'Lama Stage',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "brandTagline" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "loginHeadline" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "supportEmail" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "supportPhone" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "legalFooter" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "logoDarkBgUrl" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "logoLightBgUrl" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "primaryColorHex" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "documentFooterText" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "emailSenderName" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "emailFooterText" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "replyToEmail" TEXT;
