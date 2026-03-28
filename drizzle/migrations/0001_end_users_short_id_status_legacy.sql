-- Align legacy `end_users` rows with current app schema (`short_id`, `status` enum).
-- Safe if `0000_squashed` already created these columns (mostly no-op).

DO $e$ BEGIN
  CREATE TYPE "public"."enduser_status" AS ENUM('active', 'suspended', 'churned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $e$;--> statement-breakpoint

ALTER TABLE "end_users" ADD COLUMN IF NOT EXISTS "short_id" varchar(12);--> statement-breakpoint

UPDATE "end_users"
SET "short_id" = lower(substr(replace((gen_random_uuid())::text, '-', ''), 1, 12))
WHERE "short_id" IS NULL OR trim(coalesce("short_id", '')) = '';--> statement-breakpoint

UPDATE "end_users" u
SET "short_id" = lower(substr(replace((gen_random_uuid())::text, '-', ''), 1, 12))
WHERE EXISTS (
  SELECT 1 FROM "end_users" u2 WHERE u2."short_id" = u."short_id" AND u2."id" <> u."id"
);--> statement-breakpoint

ALTER TABLE "end_users" ALTER COLUMN "short_id" SET NOT NULL;--> statement-breakpoint

DO $uq$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'end_users'
      AND c.conname = 'end_users_short_id_unique'
  ) THEN
    ALTER TABLE "end_users" ADD CONSTRAINT "end_users_short_id_unique" UNIQUE ("short_id");
  END IF;
END $uq$;--> statement-breakpoint

ALTER TABLE "end_users" ADD COLUMN IF NOT EXISTS "status" "public"."enduser_status";--> statement-breakpoint

DO $m$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'end_users' AND column_name = 'suspended'
  ) THEN
    UPDATE "end_users"
    SET "status" = CASE
      WHEN "suspended" THEN 'suspended'::"public"."enduser_status"
      ELSE 'active'::"public"."enduser_status"
    END
    WHERE "status" IS NULL;
    ALTER TABLE "end_users" DROP COLUMN "suspended";
  END IF;
END $m$;--> statement-breakpoint

UPDATE "end_users" SET "status" = 'active'::"public"."enduser_status" WHERE "status" IS NULL;--> statement-breakpoint

ALTER TABLE "end_users" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."enduser_status";--> statement-breakpoint

ALTER TABLE "end_users" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
