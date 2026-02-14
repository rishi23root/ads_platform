CREATE TYPE "public"."campaign_type" AS ENUM('ads', 'popup', 'notification');--> statement-breakpoint
CREATE TYPE "public"."frequency_type" AS ENUM('full_day', 'time_based', 'only_once', 'always', 'specific_count');--> statement-breakpoint
CREATE TYPE "public"."target_audience" AS ENUM('new_users', 'all_users');--> statement-breakpoint
CREATE TABLE "campaign_ads" (
	"campaign_id" uuid NOT NULL,
	"ad_id" uuid NOT NULL,
	CONSTRAINT "campaign_ads_campaign_id_ad_id_pk" PRIMARY KEY("campaign_id","ad_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_notification" (
	"campaign_id" uuid PRIMARY KEY NOT NULL,
	"notification_id" uuid NOT NULL,
	CONSTRAINT "campaign_notification_notification_id_unique" UNIQUE("notification_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_platforms" (
	"campaign_id" uuid NOT NULL,
	"platform_id" uuid NOT NULL,
	CONSTRAINT "campaign_platforms_campaign_id_platform_id_pk" PRIMARY KEY("campaign_id","platform_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"target_audience" "target_audience" DEFAULT 'all_users' NOT NULL,
	"campaign_type" "campaign_type" NOT NULL,
	"frequency_type" "frequency_type" NOT NULL,
	"frequency_count" integer,
	"time_start" time,
	"time_end" time,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "html_code" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "cta_link" text;--> statement-breakpoint
ALTER TABLE "campaign_ads" ADD CONSTRAINT "campaign_ads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_ads" ADD CONSTRAINT "campaign_ads_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_notification" ADD CONSTRAINT "campaign_notification_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_notification" ADD CONSTRAINT "campaign_notification_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_platforms" ADD CONSTRAINT "campaign_platforms_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_platforms" ADD CONSTRAINT "campaign_platforms_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;