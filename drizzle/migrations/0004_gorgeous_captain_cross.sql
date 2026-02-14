CREATE TABLE "campaign_visitor_views" (
	"campaign_id" uuid NOT NULL,
	"visitor_id" varchar(255) NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_visitor_views_campaign_id_visitor_id_pk" PRIMARY KEY("campaign_id","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_visitor_views" ADD CONSTRAINT "campaign_visitor_views_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;