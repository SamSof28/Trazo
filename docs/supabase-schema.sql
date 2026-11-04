-- Trazo · esquema completo para Supabase/PostgreSQL
-- Generado desde backend/prisma/migrations (0001–0005).
-- Proyecto aplicado: dewtkwfoziiqkeijbipg (bucket Storage: catalog).
-- Fecha: 2026-11-03.
--
-- Uso recomendado en el backend:
--   npm run db:deploy -w backend
--   npm run db:seed -w backend
--
-- Este archivo sirve para revisión o para bootstrap manual en una base VACÍA
-- desde el SQL Editor de Supabase. Si lo ejecutas manualmente, no vuelvas a
-- correr "prisma migrate deploy" sobre la misma base: las tablas ya existirán.
-- Para una base nueva, prefiere siempre "npm run db:deploy -w backend", que
-- registra las migraciones en "_prisma_migrations".
--
-- Orden:

--   0001_init: Fundación: usuarios, catálogo, intake, planes, IA
--   0002_catalog_search: Búsqueda trigram, GIN de tags e índice de rutas
--   0003_trip_request_adults_nullable: Adultos nullable en solicitudes incompletas
--   0004_plan_saved_margin_image: Estado SAVED, margen 0–100 y snapshot de imagen
--   0005_transport_image: Imagen principal de transporte

-- ============================================================================
-- 0001_init — Fundación: usuarios, catálogo, intake, planes, IA
-- ============================================================================
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TripRequestStatus" AS ENUM ('COLLECTING', 'AWAITING_INPUT', 'READY', 'GENERATING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TravelerType" AS ENUM ('SOLO', 'COUPLE', 'FAMILY', 'FRIENDS', 'BUSINESS');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('FLIGHT', 'BUS', 'CAR_RENTAL', 'BOAT', 'TRAIN');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('PER_PERSON', 'PER_NIGHT', 'PER_DAY', 'PER_TRIP');

-- CreateEnum
CREATE TYPE "PlanItemType" AS ENUM ('ACCOMMODATION', 'ACTIVITY', 'TRANSPORT');

-- CreateEnum
CREATE TYPE "ActivityIntensity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADVISOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "country" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "hero_image_url" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "category" SMALLINT NOT NULL,
    "room_type" VARCHAR(80) NOT NULL,
    "price_per_night_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "image_url" TEXT,
    "amenities" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "intensity" "ActivityIntensity" NOT NULL DEFAULT 'LOW',
    "duration_minutes" INTEGER NOT NULL,
    "price_per_person_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "image_url" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_options" (
    "id" UUID NOT NULL,
    "origin_destination_id" UUID,
    "destination_id" UUID NOT NULL,
    "mode" "TransportMode" NOT NULL,
    "provider" VARCHAR(120) NOT NULL,
    "price_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "pricing_unit" "PricingUnit" NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transport_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_requests" (
    "id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "prompt_original" VARCHAR(2000) NOT NULL,
    "status" "TripRequestStatus" NOT NULL DEFAULT 'COLLECTING',
    "extracted_slots" JSONB,
    "missing_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destination_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "duration_days" SMALLINT,
    "adults" SMALLINT NOT NULL DEFAULT 1,
    "children" SMALLINT NOT NULL DEFAULT 0,
    "traveler_type" "TravelerType",
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget_min_minor" BIGINT,
    "budget_max_minor" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "error_code" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "trip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "trip_request_id" UUID NOT NULL,
    "advisor_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "title" VARCHAR(120),
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "hero_image_url" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "subtotal_minor" BIGINT NOT NULL DEFAULT 0,
    "margin_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "margin_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_days" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "day_number" SMALLINT NOT NULL,
    "date" DATE NOT NULL,
    "title" VARCHAR(160),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" UUID NOT NULL,
    "plan_day_id" UUID NOT NULL,
    "type" "PlanItemType" NOT NULL,
    "hotel_id" UUID,
    "activity_id" UUID,
    "transport_option_id" UUID,
    "name_snapshot" VARCHAR(160) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "quantity" SMALLINT NOT NULL DEFAULT 1,
    "pricing_unit" "PricingUnit" NOT NULL,
    "subtotal_minor" BIGINT NOT NULL,
    "start_time" TIME(0),
    "end_time" TIME(0),
    "notes" TEXT,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "trip_request_id" UUID NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "model" VARCHAR(80),
    "latency_ms" INTEGER,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "error_code" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "destinations_country_is_active_idx" ON "destinations"("country", "is_active");

-- CreateIndex
CREATE INDEX "hotels_destination_id_is_active_price_per_night_minor_idx" ON "hotels"("destination_id", "is_active", "price_per_night_minor");

-- CreateIndex
CREATE INDEX "activities_destination_id_is_active_idx" ON "activities"("destination_id", "is_active");

-- CreateIndex
CREATE INDEX "transport_options_destination_id_is_active_mode_idx" ON "transport_options"("destination_id", "is_active", "mode");

-- CreateIndex
CREATE INDEX "trip_requests_advisor_id_status_idx" ON "trip_requests"("advisor_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plans_trip_request_id_key" ON "plans"("trip_request_id");

-- CreateIndex
CREATE INDEX "plans_advisor_id_status_idx" ON "plans"("advisor_id", "status");

-- CreateIndex
CREATE INDEX "plans_destination_id_idx" ON "plans"("destination_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_days_plan_id_day_number_key" ON "plan_days"("plan_id", "day_number");

-- CreateIndex
CREATE INDEX "plan_items_plan_day_id_idx" ON "plan_items"("plan_day_id");

-- CreateIndex
CREATE INDEX "plan_items_hotel_id_idx" ON "plan_items"("hotel_id");

-- CreateIndex
CREATE INDEX "plan_items_activity_id_idx" ON "plan_items"("activity_id");

-- CreateIndex
CREATE INDEX "plan_items_transport_option_id_idx" ON "plan_items"("transport_option_id");

-- CreateIndex
CREATE INDEX "ai_jobs_trip_request_id_status_idx" ON "ai_jobs"("trip_request_id", "status");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_options" ADD CONSTRAINT "transport_options_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_options" ADD CONSTRAINT "transport_options_origin_destination_id_fkey" FOREIGN KEY ("origin_destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_trip_request_id_fkey" FOREIGN KEY ("trip_request_id") REFERENCES "trip_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_day_id_fkey" FOREIGN KEY ("plan_day_id") REFERENCES "plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_transport_option_id_fkey" FOREIGN KEY ("transport_option_id") REFERENCES "transport_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_trip_request_id_fkey" FOREIGN KEY ("trip_request_id") REFERENCES "trip_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Domain invariants not expressible in the Prisma schema.
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_category_check" CHECK ("category" BETWEEN 1 AND 5);
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_price_check" CHECK ("price_per_night_minor" >= 0);
ALTER TABLE "activities" ADD CONSTRAINT "activities_price_check" CHECK ("price_per_person_minor" >= 0);
ALTER TABLE "activities" ADD CONSTRAINT "activities_duration_check" CHECK ("duration_minutes" > 0);
ALTER TABLE "transport_options" ADD CONSTRAINT "transport_options_price_check" CHECK ("price_minor" >= 0);
ALTER TABLE "transport_options" ADD CONSTRAINT "transport_options_duration_check" CHECK ("duration_minutes" > 0);

ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_dates_check" CHECK (
  ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date")
  AND ("duration_days" IS NULL OR "duration_days" BETWEEN 1 AND 30)
  AND ("adults" >= 1)
  AND ("children" >= 0)
  AND ("budget_min_minor" IS NULL OR "budget_min_minor" >= 0)
  AND ("budget_max_minor" IS NULL OR "budget_max_minor" >= 0)
  AND ("budget_min_minor" IS NULL OR "budget_max_minor" IS NULL OR "budget_max_minor" >= "budget_min_minor")
);

ALTER TABLE "plans" ADD CONSTRAINT "plans_money_check" CHECK (
  "subtotal_minor" >= 0
  AND "margin_minor" >= 0
  AND "total_minor" >= 0
  AND "margin_percent" >= 0
  AND "margin_percent" <= 50
  AND "total_minor" = "subtotal_minor" + "margin_minor"
);

ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_number_check" CHECK ("day_number" >= 1);

ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_catalog_check" CHECK (
  ("type" = 'ACCOMMODATION' AND "hotel_id" IS NOT NULL AND "activity_id" IS NULL AND "transport_option_id" IS NULL)
  OR ("type" = 'ACTIVITY' AND "activity_id" IS NOT NULL AND "hotel_id" IS NULL AND "transport_option_id" IS NULL)
  OR ("type" = 'TRANSPORT' AND "transport_option_id" IS NOT NULL AND "hotel_id" IS NULL AND "activity_id" IS NULL)
);
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_money_check" CHECK (
  "unit_price_minor" >= 0 AND "quantity" > 0 AND "subtotal_minor" >= 0
);
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_position_check" CHECK ("position" >= 0);

-- ============================================================================
-- 0002_catalog_search — Búsqueda trigram, GIN de tags e índice de rutas
-- ============================================================================
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

-- ============================================================================
-- 0003_trip_request_adults_nullable — Adultos nullable en solicitudes incompletas
-- ============================================================================
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

-- ============================================================================
-- 0004_plan_saved_margin_image — Estado SAVED, margen 0–100 y snapshot de imagen
-- ============================================================================
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

-- ============================================================================
-- 0005_transport_image — Imagen principal de transporte
-- ============================================================================
-- Every catalog entity exposes a main image so the frontend can render
-- destinations, hotels, activities and transport with the same contract.
ALTER TABLE "transport_options" ADD COLUMN "image_url" TEXT;
