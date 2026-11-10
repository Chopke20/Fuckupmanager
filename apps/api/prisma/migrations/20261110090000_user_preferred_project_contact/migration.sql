-- Per-user default project contact for PDF footer ("Opiekun projektu").
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferredProjectContactId" TEXT;
