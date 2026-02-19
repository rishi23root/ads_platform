-- Final schema migration (single consolidated file)
-- Idempotent: safe to run on fresh DBs and existing DBs that ran old migrations.

-- Drop legacy tables if they exist (from pre-consolidation schema)
DROP TABLE IF EXISTS "notification_reads";
DROP TABLE IF EXISTS "campaign_visitor_views";
DROP TABLE IF EXISTS "campaign_logs";
DROP TABLE IF EXISTS "request_logs";

-- Enums (idempotent)
DO $enum$
BEGIN
  CREATE TYPE "public"."campaign_status" AS ENUM('active', 'inactive', 'scheduled', 'expired');
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
  CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

DO $enum$
BEGIN
  CREATE TYPE "public"."visitor_event_type" AS ENUM('ad', 'notification', 'popup', 'request');
EXCEPTION WHEN duplicate_object THEN NULL;
END $enum$;

-- Add 'request' to visitor_event_type if enum exists without it (existing DBs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'visitor_event_type' AND e.enumlabel = 'request'
  ) THEN
    ALTER TYPE "public"."visitor_event_type" ADD VALUE 'request';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables (idempotent)
CREATE TABLE IF NOT EXISTS "user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" varchar(255),
	"banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" varchar(255),
	"id_token" text,
	"password" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(255),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "verification" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"target_url" text,
	"html_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"cta_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"target_audience" "target_audience" DEFAULT 'all_users' NOT NULL,
	"campaign_type" "campaign_type" NOT NULL,
	"frequency_type" "frequency_type" NOT NULL,
	"frequency_count" integer,
	"time_start" time,
	"time_end" time,
	"status" "campaign_status" DEFAULT 'inactive' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "campaign_platforms" (
	"campaign_id" uuid NOT NULL,
	"platform_id" uuid NOT NULL,
	CONSTRAINT "campaign_platforms_campaign_id_platform_id_pk" PRIMARY KEY("campaign_id","platform_id")
);

CREATE TABLE IF NOT EXISTS "campaign_countries" (
	"campaign_id" uuid NOT NULL,
	"country_code" varchar(2) NOT NULL,
	CONSTRAINT "campaign_countries_campaign_id_country_code_pk" PRIMARY KEY("campaign_id","country_code")
);

CREATE TABLE IF NOT EXISTS "campaign_ad" (
	"campaign_id" uuid NOT NULL,
	"ad_id" uuid NOT NULL,
	CONSTRAINT "campaign_ad_campaign_id_ad_id_pk" PRIMARY KEY("campaign_id","ad_id")
);

CREATE TABLE IF NOT EXISTS "campaign_notification" (
	"campaign_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	CONSTRAINT "campaign_notification_campaign_id_notification_id_pk" PRIMARY KEY("campaign_id","notification_id")
);

-- Visitors (idempotent)
CREATE TABLE IF NOT EXISTS "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" varchar(255) NOT NULL,
	"campaign_id" uuid,
	"domain" varchar(255),
	"type" "visitor_event_type" NOT NULL,
	"country" varchar(2),
	"status_code" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add status_code if missing (existing DBs from before 0003)
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "status_code" integer;

-- Make domain nullable if it was NOT NULL (existing DBs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'visitors' AND column_name = 'domain'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "visitors" ALTER COLUMN "domain" DROP NOT NULL;
  END IF;
END $$;

-- Visitor indexes
CREATE INDEX IF NOT EXISTS "idx_visitors_campaign_created" ON "visitors" ("campaign_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_campaign" ON "visitors" ("visitor_id", "campaign_id");
CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_created" ON "visitors" ("visitor_id", "created_at" DESC);

-- Foreign keys (idempotent: only add if constraint does not exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_user_id_user_id_fk') THEN
    ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_user_id_fk') THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_created_by_user_id_fk') THEN
    ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_ad_campaign_id_campaigns_id_fk') THEN
    ALTER TABLE "campaign_ad" ADD CONSTRAINT "campaign_ad_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_ad_ad_id_ads_id_fk') THEN
    ALTER TABLE "campaign_ad" ADD CONSTRAINT "campaign_ad_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_countries_campaign_id_campaigns_id_fk') THEN
    ALTER TABLE "campaign_countries" ADD CONSTRAINT "campaign_countries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_notification_campaign_id_campaigns_id_fk') THEN
    ALTER TABLE "campaign_notification" ADD CONSTRAINT "campaign_notification_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_notification_notification_id_notifications_id_fk') THEN
    ALTER TABLE "campaign_notification" ADD CONSTRAINT "campaign_notification_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_platforms_campaign_id_campaigns_id_fk') THEN
    ALTER TABLE "campaign_platforms" ADD CONSTRAINT "campaign_platforms_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_platforms_platform_id_platforms_id_fk') THEN
    ALTER TABLE "campaign_platforms" ADD CONSTRAINT "campaign_platforms_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitors_campaign_id_campaigns_id_fk') THEN
    ALTER TABLE "visitors" ADD CONSTRAINT "visitors_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
