CREATE TYPE "public"."campaign_status" AS ENUM('active', 'inactive', 'scheduled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('ads', 'popup', 'notification', 'redirect');--> statement-breakpoint
CREATE TYPE "public"."enduser_event_type" AS ENUM('ad', 'notification', 'popup', 'request', 'redirect', 'visit');--> statement-breakpoint
CREATE TYPE "public"."enduser_user_plan" AS ENUM('trial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."enduser_status" AS ENUM('active', 'suspended', 'churned');--> statement-breakpoint
CREATE TYPE "public"."frequency_type" AS ENUM('full_day', 'time_based', 'only_once', 'always', 'specific_count');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."target_audience" AS ENUM('new_users', 'all_users');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" varchar(255),
	"id_token" text,
	"password" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"target_url" text,
	"html_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"status" "campaign_status" DEFAULT 'inactive' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"ad_id" uuid,
	"notification_id" uuid,
	"redirect_id" uuid,
	"platform_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"country_codes" varchar(2)[] DEFAULT '{}'::varchar(2)[] NOT NULL,
	"created_by" varchar(255) DEFAULT 'SYSTEM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "end_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"password_hash" varchar(255),
	"installation_id" varchar(255),
	"short_id" varchar(12) NOT NULL,
	"name" varchar(255),
	"plan" "enduser_user_plan" DEFAULT 'trial' NOT NULL,
	"status" "enduser_status" DEFAULT 'active' NOT NULL,
	"country" varchar(2),
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "end_users_email_unique" UNIQUE("email"),
	CONSTRAINT "end_users_installation_id_unique" UNIQUE("installation_id"),
	CONSTRAINT "end_users_short_id_unique" UNIQUE("short_id")
);
--> statement-breakpoint
CREATE TABLE "enduser_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enduser_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"plan" "enduser_user_plan" DEFAULT 'trial' NOT NULL,
	"campaign_id" uuid,
	"domain" varchar(255),
	"type" "enduser_event_type" NOT NULL,
	"country" varchar(2),
	"status_code" integer,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enduser_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"end_user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(255),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enduser_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"cta_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"end_user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "payment_status" DEFAULT 'completed' NOT NULL,
	"description" text,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_domain" varchar(255) NOT NULL,
	"include_subdomains" boolean DEFAULT false NOT NULL,
	"destination_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(255),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" varchar(255),
	"banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_redirect_id_redirects_id_fk" FOREIGN KEY ("redirect_id") REFERENCES "public"."redirects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set default ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enduser_events" ADD CONSTRAINT "enduser_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enduser_sessions" ADD CONSTRAINT "enduser_sessions_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_ad_id_idx" ON "campaigns" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "campaigns_notification_id_idx" ON "campaigns" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "campaigns_redirect_id_idx" ON "campaigns" USING btree ("redirect_id");--> statement-breakpoint
CREATE INDEX "enduser_events_enduser_id_idx" ON "enduser_events" USING btree ("enduser_id");--> statement-breakpoint
CREATE INDEX "enduser_events_email_idx" ON "enduser_events" USING btree ("email");--> statement-breakpoint
CREATE INDEX "enduser_events_campaign_id_idx" ON "enduser_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "enduser_events_type_idx" ON "enduser_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "enduser_events_created_at_idx" ON "enduser_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "enduser_events_enduser_created_idx" ON "enduser_events" USING btree ("enduser_id","created_at");--> statement-breakpoint
CREATE INDEX "enduser_events_email_created_idx" ON "enduser_events" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "enduser_events_campaign_created_idx" ON "enduser_events" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "enduser_events_enduser_campaign_idx" ON "enduser_events" USING btree ("enduser_id","campaign_id");--> statement-breakpoint
CREATE INDEX "idx_enduser_sessions_end_user_id" ON "enduser_sessions" USING btree ("end_user_id");--> statement-breakpoint
CREATE INDEX "idx_payments_end_user_id" ON "payments" USING btree ("end_user_id");