CREATE TABLE "target_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"filter_json" jsonb,
	"member_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "target_list_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_target_list_id_target_lists_id_fk" FOREIGN KEY ("target_list_id") REFERENCES "public"."target_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_target_list_id_idx" ON "campaigns" USING btree ("target_list_id");--> statement-breakpoint
CREATE INDEX "target_lists_member_ids_gin" ON "target_lists" USING gin ("member_ids");
