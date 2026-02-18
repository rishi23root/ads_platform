#!/usr/bin/env npx tsx
/**
 * One-off fix: create request_logs table and request_log_type enum if missing.
 * Safe to run multiple times (uses IF NOT EXISTS / duplicate_object handling).
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
    // Create request_log_type enum
    await sql.unsafe(`
      DO $enum$
      BEGIN
        CREATE TYPE "public"."request_log_type" AS ENUM('ad', 'notification', 'popup');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      $enum$;
    `);
    console.log('✓ request_log_type enum ensured');

    // Create request_logs table
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "request_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "visitor_id" varchar(255) NOT NULL,
        "domain" varchar(255) NOT NULL,
        "request_type" "request_log_type" NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ request_logs table ensured');

    // Create index
    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS "idx_request_logs_visitor_created" ON "request_logs" ("visitor_id", "created_at" DESC);
    `);
    console.log('✓ idx_request_logs_visitor_created index ensured');

    console.log('Done.');
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
