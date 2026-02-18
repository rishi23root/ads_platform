-- Consolidate visitors: drop old tables, create event-based visitors
-- Run when DB has old schema (visitors without campaign_id)

DO $enum$
BEGIN
  CREATE TYPE "public"."visitor_event_type" AS ENUM('ad', 'notification', 'popup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

DROP TABLE IF EXISTS "campaign_visitor_views";

DROP TABLE IF EXISTS "campaign_logs";

DROP TABLE IF EXISTS "request_logs";

DROP TABLE IF EXISTS "visitors";

CREATE TABLE "visitors" (
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

CREATE INDEX IF NOT EXISTS "idx_visitors_campaign_created" ON "visitors" (
    "campaign_id",
    "created_at" DESC
);

CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_campaign" ON "visitors" ("visitor_id", "campaign_id");

CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_created" ON "visitors" (
    "visitor_id",
    "created_at" DESC
);

TRUNCATE TABLE "notification_reads";