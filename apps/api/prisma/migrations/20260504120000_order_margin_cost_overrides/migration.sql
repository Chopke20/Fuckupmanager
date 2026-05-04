-- Optional per-line cost overrides for margin (rental / subcontractor).
-- When both quantity and unit cost are NULL, existing margin logic applies (full line net).

ALTER TABLE "order_equipment_items"
ADD COLUMN IF NOT EXISTS "marginRentalUnits" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "marginRentalUnitCostNet" DOUBLE PRECISION;

ALTER TABLE "order_production_items"
ADD COLUMN IF NOT EXISTS "marginSubcontractorUnits" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "marginSubcontractorUnitCostNet" DOUBLE PRECISION;
