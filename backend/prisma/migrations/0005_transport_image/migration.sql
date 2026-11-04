-- Every catalog entity exposes a main image so the frontend can render
-- destinations, hotels, activities and transport with the same contract.
ALTER TABLE "transport_options" ADD COLUMN "image_url" TEXT;
