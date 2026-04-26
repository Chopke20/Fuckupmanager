-- Replace single project contact fields with a list + default selection.
-- Keep idempotent for safe rollouts.

ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "projectContactsJson" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "defaultProjectContactId" TEXT;

-- Backfill from legacy single-contact fields if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'projectContactName'
  ) THEN
    UPDATE "app_settings"
    SET "projectContactsJson" = COALESCE(
      NULLIF("projectContactsJson", ''),
      CASE
        WHEN "projectContactName" IS NULL OR btrim("projectContactName") = '' THEN NULL
        ELSE json_build_array(
          json_build_object(
            'id', 'LEGACY',
            'name', "projectContactName",
            'phone', "projectContactPhone",
            'email', "projectContactEmail"
          )
        )::text
      END
    ),
    "defaultProjectContactId" = COALESCE(
      NULLIF("defaultProjectContactId", ''),
      CASE
        WHEN "projectContactName" IS NULL OR btrim("projectContactName") = '' THEN NULL
        ELSE 'LEGACY'
      END
    )
    WHERE "projectContactsJson" IS NULL OR btrim("projectContactsJson") = '';
  END IF;
END $$;

