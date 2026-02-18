-- Consolidate visitors, campaign_visitor_views, campaign_logs, request_logs into single visitors table
-- Migration: create new visitors (event-based), migrate campaign_logs, drop old tables

-- Create visitor_event_type enum (same values as campaign_log_type)
DO $enum$
BEGIN
  CREATE TYPE "public"."visitor_event_type" AS ENUM('ad', 'notification', 'popup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

-- Create new visitors table (event-based)
CREATE TABLE IF NOT EXISTS "visitors_new" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    "visitor_id" varchar(255) NOT NULL,
    "campaign_id" uuid REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "domain" varchar(255) NOT NULL,
    "type" "visitor_event_type" NOT NULL,
    "country" varchar(2),
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

-- Migrate campaign_logs into visitors_new (only if campaign_logs exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_logs') THEN
    INSERT INTO "visitors_new" ("id", "visitor_id", "campaign_id", "domain", "type", "country", "created_at")
    SELECT "id", "visitor_id", "campaign_id", "domain", "type"::text::"visitor_event_type", "country", "created_at"
    FROM "campaign_logs";
  END IF;
END $$;

-- Drop old tables
DROP TABLE IF EXISTS "campaign_visitor_views";

DROP TABLE IF EXISTS "campaign_logs";

DROP TABLE IF EXISTS "request_logs";

DROP TABLE IF EXISTS "visitors";

-- Rename visitors_new to visitors
ALTER TABLE "visitors_new" RENAME TO "visitors";

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_visitors_campaign_created" ON "visitors" (
    "campaign_id",
    "created_at" DESC
);

CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_campaign" ON "visitors" ("visitor_id", "campaign_id");

CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_created" ON "visitors" (
    "visitor_id",
    "created_at" DESC
);