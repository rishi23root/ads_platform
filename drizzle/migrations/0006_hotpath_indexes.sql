-- Hot-path indexes for the extension serve path and dashboard analytics.
-- All indexes use IF NOT EXISTS so the migration is idempotent.

-- Extension ad-serving qualifies active campaigns by date window on every /serve request.
-- A partial index on status='active' keeps this index small (matches only the working set)
-- and covers the (start_date, end_date) range filter used in the cache miss path.
CREATE INDEX IF NOT EXISTS "campaigns_active_window_idx"
  ON "campaigns" ("start_date", "end_date")
  WHERE "status" = 'active';
--> statement-breakpoint

-- Dashboard analytics filter events by domain (ilike), country (equality), and time.
-- domain: btree supports `lower(domain) = ?` and prefix matches with text_pattern_ops.
CREATE INDEX IF NOT EXISTS "enduser_events_domain_idx"
  ON "enduser_events" ("domain");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "enduser_events_country_idx"
  ON "enduser_events" ("country");
--> statement-breakpoint

-- Session cleanup queries scan by expires_at. A direct index lets the sweeper drop expired
-- rows efficiently without rewriting the whole table.
CREATE INDEX IF NOT EXISTS "enduser_sessions_expires_at_idx"
  ON "enduser_sessions" ("expires_at");
--> statement-breakpoint

-- Optional trigram index for the `domain ILIKE '%substring%'` dashboard search. Requires
-- pg_trgm; the DO block keeps the migration succeeding in environments where the role
-- can't enable the extension (shared hosts). In that case the substring search falls
-- back to a sequential scan on enduser_events — which is acceptable for the admin UI.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'pg_trgm extension skipped: insufficient privilege';
      RETURN;
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_trgm extension skipped: %', SQLERRM;
      RETURN;
  END;

  EXECUTE 'CREATE INDEX IF NOT EXISTS "enduser_events_domain_trgm_idx"
           ON "enduser_events" USING gin ("domain" gin_trgm_ops)';
END $$;
