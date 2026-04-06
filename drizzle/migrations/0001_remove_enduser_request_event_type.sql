DELETE FROM "enduser_events" WHERE "type" = 'request';
--> statement-breakpoint
CREATE TYPE "public"."enduser_event_type_new" AS ENUM('ad', 'notification', 'popup', 'redirect', 'visit');
--> statement-breakpoint
ALTER TABLE "enduser_events" ALTER COLUMN "type" TYPE "public"."enduser_event_type_new" USING ("type"::text::"public"."enduser_event_type_new");
--> statement-breakpoint
DROP TYPE "public"."enduser_event_type";
--> statement-breakpoint
ALTER TYPE "public"."enduser_event_type_new" RENAME TO "enduser_event_type";
