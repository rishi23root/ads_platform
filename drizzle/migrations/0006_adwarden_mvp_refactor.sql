-- Adwarden MVP Refactor Migration
-- Schema consolidation: campaigns have status/dates, 1 ad or 1 notification per campaign, campaign_logs

-- 1. Create new enums
CREATE TYPE "campaign_status" AS ENUM ('active', 'inactive', 'scheduled', 'expired');
CREATE TYPE "campaign_log_type" AS ENUM ('ad', 'notification', 'popup');

-- 2. Add new columns to campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "status" "campaign_status" DEFAULT 'inactive' NOT NULL;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "start_date" timestamp with time zone;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "end_date" timestamp with time zone;

-- 3. Create campaign_ad (1:1) and migrate from campaign_ads
CREATE TABLE IF NOT EXISTS "campaign_ad" (
  "campaign_id" uuid PRIMARY KEY NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "ad_id" uuid NOT NULL UNIQUE REFERENCES "ads"("id") ON DELETE CASCADE
);

-- Migrate: one ad per campaign (first one)
INSERT INTO "campaign_ad" ("campaign_id", "ad_id")
SELECT DISTINCT ON ("campaign_id") "campaign_id", "ad_id"
FROM "campaign_ads"
ON CONFLICT ("campaign_id") DO NOTHING;

DROP TABLE IF EXISTS "campaign_ads";

-- 4. Create campaign_logs
CREATE TABLE IF NOT EXISTS "campaign_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "visitor_id" varchar(255) NOT NULL,
  "domain" varchar(255) NOT NULL,
  "type" "campaign_log_type" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. Drop legacy tables
DROP TABLE IF EXISTS "ad_platforms";
DROP TABLE IF EXISTS "extension_users";
DROP TABLE IF EXISTS "request_logs";

-- 6. Alter ads: remove platformId, status, startDate, endDate
ALTER TABLE "ads" DROP COLUMN IF EXISTS "platform_id";
ALTER TABLE "ads" DROP COLUMN IF EXISTS "status";
ALTER TABLE "ads" DROP COLUMN IF EXISTS "start_date";
ALTER TABLE "ads" DROP COLUMN IF EXISTS "end_date";

-- 7. Alter notifications: remove startDate, endDate, isRead
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "start_date";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "end_date";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "is_read";

-- 8. Drop old enums (if they exist and are unused)
DROP TYPE IF EXISTS "ad_status";
DROP TYPE IF EXISTS "request_type";
