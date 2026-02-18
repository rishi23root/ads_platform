#!/usr/bin/env npx tsx
/**
 * Sync database schema: drop unused tables, ensure visitors has correct structure.
 * Run: npx tsx scripts/sync-schema.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Use .env.local or set the env var.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    // Create visitor_event_type enum if not exists
    await sql.unsafe(`
      DO $enum$
      BEGIN
        CREATE TYPE "public"."visitor_event_type" AS ENUM('ad', 'notification', 'popup');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $enum$;
    `);
    console.log('✓ visitor_event_type enum ensured');

    // Drop unused tables (old schema)
    for (const table of ['campaign_visitor_views', 'campaign_logs', 'request_logs']) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      console.log(`✓ dropped ${table} (if existed)`);
    }

    // Drop visitors and recreate with correct structure
    await sql.unsafe(`DROP TABLE IF EXISTS "visitors" CASCADE`);
    console.log('✓ dropped visitors');

    await sql.unsafe(`
      CREATE TABLE "visitors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "visitor_id" varchar(255) NOT NULL,
        "campaign_id" uuid REFERENCES "campaigns" ("id") ON DELETE CASCADE,
        "domain" varchar(255) NOT NULL,
        "type" "visitor_event_type" NOT NULL,
        "country" varchar(2),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ created visitors (event-based)');

    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "idx_visitors_campaign_created" ON "visitors" ("campaign_id", "created_at" DESC)`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_campaign" ON "visitors" ("visitor_id", "campaign_id")`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "idx_visitors_visitor_created" ON "visitors" ("visitor_id", "created_at" DESC)`);
    console.log('✓ created indexes');

    console.log('\nDone. Schema synced.');
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
