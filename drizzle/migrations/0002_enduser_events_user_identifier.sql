-- Backfill extension user identifiers (matches allocateUniqueEndUserIdentifier: ext_ + 32 hex chars)
UPDATE "end_users"
SET "identifier" = 'ext_' || replace(gen_random_uuid()::text, '-', '')
WHERE "identifier" IS NULL;
--> statement-breakpoint
ALTER TABLE "end_users" ALTER COLUMN "identifier" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "enduser_events" ADD COLUMN "user_identifier" varchar(255);
--> statement-breakpoint
UPDATE "enduser_events" AS e
SET "user_identifier" = u."identifier"
FROM "end_users" AS u
WHERE e."enduser_id" = u."id"::text;
--> statement-breakpoint
UPDATE "enduser_events" SET "user_identifier" = "enduser_id" WHERE "user_identifier" IS NULL;
--> statement-breakpoint
ALTER TABLE "enduser_events" ALTER COLUMN "user_identifier" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "enduser_events_email_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "enduser_events_email_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "enduser_events_enduser_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "enduser_events_enduser_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "enduser_events_enduser_campaign_idx";
--> statement-breakpoint
ALTER TABLE "enduser_events" DROP COLUMN IF EXISTS "email";
--> statement-breakpoint
ALTER TABLE "enduser_events" DROP COLUMN IF EXISTS "plan";
--> statement-breakpoint
ALTER TABLE "enduser_events" DROP COLUMN IF EXISTS "status_code";
--> statement-breakpoint
ALTER TABLE "enduser_events" DROP COLUMN "enduser_id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enduser_events_user_identifier_idx" ON "enduser_events" USING btree ("user_identifier");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enduser_events_user_identifier_created_idx" ON "enduser_events" USING btree ("user_identifier","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enduser_events_user_identifier_campaign_idx" ON "enduser_events" USING btree ("user_identifier","campaign_id");
