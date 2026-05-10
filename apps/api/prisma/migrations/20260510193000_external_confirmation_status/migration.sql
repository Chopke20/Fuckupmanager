-- External confirmations for rentals and subcontractors used by overview alerts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'ExternalConfirmationStatus'
  ) THEN
    CREATE TYPE "ExternalConfirmationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'DECLINED');
  END IF;
END $$;

ALTER TABLE "order_equipment_items"
ADD COLUMN IF NOT EXISTS "externalConfirmationStatus" "ExternalConfirmationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN IF NOT EXISTS "externalConfirmationDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "externalConfirmedAt" TIMESTAMP(3);

ALTER TABLE "order_production_items"
ADD COLUMN IF NOT EXISTS "externalConfirmationStatus" "ExternalConfirmationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN IF NOT EXISTS "externalConfirmationDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "externalConfirmedAt" TIMESTAMP(3);

-- Existing external lines should be visible in overview as pending.
UPDATE "order_equipment_items"
SET "externalConfirmationStatus" = 'PENDING'
WHERE "isRental" = true
  AND "externalConfirmationStatus" = 'NOT_REQUIRED';

UPDATE "order_production_items"
SET "externalConfirmationStatus" = 'PENDING'
WHERE "isSubcontractor" = true
  AND "externalConfirmationStatus" = 'NOT_REQUIRED';
