ALTER TABLE "target_lists" ADD COLUMN "excluded_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
CREATE INDEX "target_lists_excluded_ids_gin" ON "target_lists" USING gin ("excluded_ids");
