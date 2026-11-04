-- SAVED is editable and lets an advisor reopen a plan without publishing it.
ALTER TYPE "PlanStatus" ADD VALUE IF NOT EXISTS 'SAVED';

-- Plans can carry a commercial margin up to 100% (HU 2.9).
ALTER TABLE "plans" DROP CONSTRAINT "plans_money_check";
ALTER TABLE "plans" ADD CONSTRAINT "plans_money_check" CHECK (
  "subtotal_minor" >= 0
  AND "margin_minor" >= 0
  AND "total_minor" >= 0
  AND "margin_percent" >= 0
  AND "margin_percent" <= 100
  AND "total_minor" = "subtotal_minor" + "margin_minor"
);

-- Snapshot the catalog image so the timeline survives catalog edits.
ALTER TABLE "plan_items" ADD COLUMN "image_url" TEXT;
