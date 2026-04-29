-- Add optional visibility flag for "Toinen Music mode" (offer PDF).
-- Safe to run repeatedly.

ALTER TABLE "app_settings"
ADD COLUMN IF NOT EXISTS "enableToinenMusicMode" BOOLEAN NOT NULL DEFAULT FALSE;

