-- Allow same ad/notification to be used in multiple campaigns
-- Drop UNIQUE constraints and use composite PK (campaign_id, ad_id) and (campaign_id, notification_id)

-- campaign_ad: drop old PK and unique, add composite PK
ALTER TABLE "campaign_ad"
DROP CONSTRAINT IF EXISTS "campaign_ad_pkey";

ALTER TABLE "campaign_ad"
DROP CONSTRAINT IF EXISTS "campaign_ad_ad_id_key";

ALTER TABLE "campaign_ad" ADD PRIMARY KEY ("campaign_id", "ad_id");

-- campaign_notification: drop old PK and unique, add composite PK
ALTER TABLE "campaign_notification"
DROP CONSTRAINT IF EXISTS "campaign_notification_pkey";

ALTER TABLE "campaign_notification"
DROP CONSTRAINT IF EXISTS "campaign_notification_notification_id_key";

ALTER TABLE "campaign_notification"
DROP CONSTRAINT IF EXISTS "campaign_notification_notification_id_unique";

ALTER TABLE "campaign_notification"
ADD PRIMARY KEY (
    "campaign_id",
    "notification_id"
);