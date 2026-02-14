-- Add campaign_countries junction table for country targeting
CREATE TABLE IF NOT EXISTS "campaign_countries" (
    "campaign_id" uuid NOT NULL REFERENCES "campaigns" ("id") ON DELETE CASCADE,
    "country_code" varchar(2) NOT NULL,
    PRIMARY KEY ("campaign_id", "country_code")
);