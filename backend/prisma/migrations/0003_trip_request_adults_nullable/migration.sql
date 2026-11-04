-- A TripRequest can be created before the advisor knows how many travelers are coming.
-- The previous NOT NULL DEFAULT 1 made an incomplete request look complete after a reload.
ALTER TABLE "trip_requests" ALTER COLUMN "adults" DROP NOT NULL;
ALTER TABLE "trip_requests" ALTER COLUMN "adults" DROP DEFAULT;

ALTER TABLE "trip_requests" DROP CONSTRAINT "trip_requests_dates_check";
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_dates_check" CHECK (
  ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date")
  AND ("duration_days" IS NULL OR "duration_days" BETWEEN 1 AND 30)
  AND ("adults" IS NULL OR "adults" >= 1)
  AND ("children" >= 0)
  AND ("budget_min_minor" IS NULL OR "budget_min_minor" >= 0)
  AND ("budget_max_minor" IS NULL OR "budget_max_minor" >= 0)
  AND ("budget_min_minor" IS NULL OR "budget_max_minor" IS NULL OR "budget_max_minor" >= "budget_min_minor")
);
