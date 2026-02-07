--> statement-breakpoint
DROP TABLE IF EXISTS "notification_platforms";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"visitor_id" varchar(255) NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "notification_reads_notification_id_visitor_id_unique" UNIQUE("notification_id", "visitor_id")
);
