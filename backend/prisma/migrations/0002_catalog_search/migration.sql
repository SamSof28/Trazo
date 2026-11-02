-- Phase 2: catalog search indexes.
-- Prisma does not model trigram or GIN indexes, so they live in this migration.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "destinations_city_trgm_idx"
  ON "destinations" USING GIN ("city" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "destinations_slug_trgm_idx"
  ON "destinations" USING GIN ("slug" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "activities_tags_gin_idx"
  ON "activities" USING GIN ("tags");

CREATE INDEX IF NOT EXISTS "transport_options_origin_destination_mode_idx"
  ON "transport_options" ("origin_destination_id", "destination_id", "mode");
