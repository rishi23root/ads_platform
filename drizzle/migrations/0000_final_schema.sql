-- Final schema migration (single consolidated file)
-- Keeps: user, session, account, verification, platforms, ads, notifications, campaigns, campaign_platforms, campaign_countries, campaign_ad, campaign_notification
-- Visitors: event-based (one row per serve). Clears visitor/log data.

-- Enums
DO $enum$
BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

DO $enum$
BEGIN
  CREATE TYPE "public"."campaign_type" AS ENUM('ads', 'popup', 'notification');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

DO $enum$
BEGIN
  CREATE TYPE "public"."frequency_type" AS ENUM('full_day', 'time_based', 'only_once', 'always', 'specific_count');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

DO $enum$
BEGIN
  CREATE TYPE "public"."target_audience" AS ENUM('new_users', 'all_users');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

DO $enum$
BEGIN
  CREATE TYPE "public"."campaign_status" AS ENUM('active', 'inactive', 'scheduled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

DO $enum$
BEGIN
  CREATE TYPE "public"."visitor_event_type" AS ENUM('ad', 'notification', 'popup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "name" varchar(255),
    "email" varchar(255) NOT NULL UNIQUE,
    "email_verified" boolean DEFAULT false NOT NULL,
    "image" varchar(255),
    "banned" boolean DEFAULT false NOT NULL,
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "role" "user_role" DEFAULT 'user' NOT NULL
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "user_id" varchar(255) NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "account_id" varchar(255) NOT NULL,
    "provider_id" varchar(255) NOT NULL,
    "access_token" text,
    "refresh_token" text,
    "access_token_expires_at" timestamp
    with
        time zone,
        "refresh_token_expires_at" timestamp
    with
        time zone,
        "scope" varchar(255),
        "id_token" text,
        "password" varchar(255),
        "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "user_id" varchar(255) NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "token" varchar(255) NOT NULL UNIQUE,
    "expires_at" timestamp
    with
        time zone NOT NULL,
        "ip_address" varchar(255),
        "user_agent" varchar(255),
        "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" varchar(255) PRIMARY KEY NOT NULL,
    "identifier" varchar(255) NOT NULL,
    "value" varchar(255) NOT NULL,
    "expires_at" timestamp
    with
        time zone NOT NULL,
        "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

-- Platforms
CREATE TABLE IF NOT EXISTS "platforms" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "name" varchar(255) NOT NULL,
    "domain" varchar(255) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

-- Ads
CREATE TABLE IF NOT EXISTS "ads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "name" varchar(255) NOT NULL,
    "description" text,
    "image_url" text,
    "target_url" text,
    "html_code" text,
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "title" varchar(255) NOT NULL,
    "message" text NOT NULL,
    "cta_link" text,
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

-- Notification reads
CREATE TABLE IF NOT EXISTS "notification_reads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "notification_id" uuid NOT NULL REFERENCES "notifications" ("id") ON DELETE CASCADE,
    "visitor_id" varchar(255) NOT NULL,
    "read_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        UNIQUE (
            "notification_id",
            "visitor_id"
        )
);

-- Campaigns
CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "name" varchar(255) NOT NULL,
    "target_audience" "target_audience" DEFAULT 'all_users' NOT NULL,
    "campaign_type" "campaign_type" NOT NULL,
    "frequency_type" "frequency_type" NOT NULL,
    "frequency_count" integer,
    "time_start" time,
    "time_end" time,
    "status" "campaign_status" DEFAULT 'inactive' NOT NULL,
    "start_date" timestamp
    with
        time zone,
        "end_date" timestamp
    with
        time zone,
        "created_by" varchar(255) NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
        "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "campaign_platforms" (
    "campaign_id" uuid NOT NULL REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "platform_id" uuid NOT NULL REFERENCES "platforms" ("id") ON DELETE CASCADE,
    PRIMARY KEY ("campaign_id", "platform_id")
);

CREATE TABLE IF NOT EXISTS "campaign_countries" (
    "campaign_id" uuid NOT NULL REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "country_code" varchar(2) NOT NULL,
    PRIMARY KEY ("campaign_id", "country_code")
);

-- campaign_ad: composite PK (same ad can be in multiple campaigns)
CREATE TABLE IF NOT EXISTS "campaign_ad" (
    "campaign_id" uuid NOT NULL REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "ad_id" uuid NOT NULL REFERENCES "ads" ("id") ON DELETE CASCADE,
    PRIMARY KEY ("campaign_id", "ad_id")
);

-- campaign_notification: composite PK (same notification can be in multiple campaigns)
CREATE TABLE IF NOT EXISTS "campaign_notification" (
    "campaign_id" uuid NOT NULL REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "notification_id" uuid NOT NULL REFERENCES "notifications" ("id") ON DELETE CASCADE,
    PRIMARY KEY (
        "campaign_id",
        "notification_id"
    )
);

-- Migrate campaign_ad to composite PK if needed (from old schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_ad') THEN
    ALTER TABLE "campaign_ad" DROP CONSTRAINT IF EXISTS "campaign_ad_pkey";
    ALTER TABLE "campaign_ad" DROP CONSTRAINT IF EXISTS "campaign_ad_ad_id_key";
    ALTER TABLE "campaign_ad" ADD PRIMARY KEY ("campaign_id", "ad_id");
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate campaign_notification to composite PK if needed (from old schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_notification') THEN
    ALTER TABLE "campaign_notification" DROP CONSTRAINT IF EXISTS "campaign_notification_pkey";
    ALTER TABLE "campaign_notification" DROP CONSTRAINT IF EXISTS "campaign_notification_notification_id_key";
    ALTER TABLE "campaign_notification" DROP CONSTRAINT IF EXISTS "campaign_notification_notification_id_unique";
    ALTER TABLE "campaign_notification" ADD PRIMARY KEY ("campaign_id", "notification_id");
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop old visitor/log tables (clear data)
DROP TABLE IF EXISTS "campaign_visitor_views";

DROP TABLE IF EXISTS "campaign_logs";

DROP TABLE IF EXISTS "request_logs";

DROP TABLE IF EXISTS "visitors";

-- Visitors (event-based: one row per serve)
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

-- Clear notification_reads (visitor-related read state)
TRUNCATE TABLE "notification_reads";