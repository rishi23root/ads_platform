CREATE TABLE "visitors" (
	"visitor_id" varchar(255) PRIMARY KEY NOT NULL,
	"country" varchar(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
