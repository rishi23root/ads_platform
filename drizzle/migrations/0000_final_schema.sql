-- Final schema migration (single file)
-- Idempotent: safe to run on fresh or existing database.

-- Enums (skip if already exist)
DO $enum$
BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END;
BEGIN
  CREATE TYPE "public"."campaign_type" AS ENUM('ads', 'popup', 'notification');
EXCEPTION WHEN duplicate_object THEN NULL; END;
BEGIN
  CREATE TYPE "public"."frequency_type" AS ENUM('full_day', 'time_based', 'only_once', 'always', 'specific_count');
EXCEPTION WHEN duplicate_object THEN NULL; END;
BEGIN
  CREATE TYPE "public"."target_audience" AS ENUM('new_users', 'all_users');
EXCEPTION WHEN duplicate_object THEN NULL; END;
BEGIN
  CREATE TYPE "public"."campaign_status" AS ENUM('active', 'inactive', 'scheduled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END;
BEGIN
  CREATE TYPE "public"."campaign_log_type" AS ENUM('ad', 'notification', 'popup');
EXCEPTION WHEN duplicate_object THEN NULL; END;
BEGIN
  CREATE TYPE "public"."request_log_type" AS ENUM('ad', 'notification', 'popup');
EXCEPTION WHEN duplicate_object THEN NULL; END;
$enum$;
--> statement-breakpoint
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

-- Ads (content only)
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

-- Notifications (content only)
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

CREATE TABLE IF NOT EXISTS "campaign_ad" (
    "campaign_id" uuid PRIMARY KEY REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "ad_id" uuid NOT NULL UNIQUE REFERENCES "ads" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "campaign_notification" (
    "campaign_id" uuid PRIMARY KEY REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "notification_id" uuid NOT NULL UNIQUE REFERENCES "notifications" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "campaign_visitor_views" (
    "campaign_id" uuid NOT NULL REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "visitor_id" varchar(255) NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "last_viewed_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        PRIMARY KEY ("campaign_id", "visitor_id")
);

-- Visitors
CREATE TABLE IF NOT EXISTS "visitors" (
    "visitor_id" varchar(255) PRIMARY KEY NOT NULL,
    "country" varchar(2),
    "total_requests" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL,
        "last_seen_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "total_requests" integer DEFAULT 0 NOT NULL;

-- Campaign logs (with country for per-request analytics)
CREATE TABLE IF NOT EXISTS "campaign_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "campaign_id" uuid NOT NULL REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "visitor_id" varchar(255) NOT NULL,
    "domain" varchar(255) NOT NULL,
    "country" varchar(2),
    "type" "campaign_log_type" NOT NULL,
    "created_at" timestamp
    with
        time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_campaign_logs_campaign_created" ON "campaign_logs" (
    "campaign_id",
    "created_at" DESC
);

-- Add country column if missing (idempotent: for existing campaign_logs from older schemas)
ALTER TABLE "campaign_logs"
ADD COLUMN IF NOT EXISTS "country" varchar(2);

-- Request logs (per-request ad/notification tracking)
CREATE TABLE IF NOT EXISTS "request_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "visitor_id" varchar(255) NOT NULL,
    "domain" varchar(255) NOT NULL,
    "request_type" "request_log_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_request_logs_visitor_created" ON "request_logs" ("visitor_id", "created_at" DESC);