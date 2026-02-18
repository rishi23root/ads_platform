#!/usr/bin/env npx tsx
/**
 * One-off fix: add total_requests column to visitors if missing.
 * Safe to run multiple times (uses IF NOT EXISTS).
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
    await sql.unsafe(`
      ALTER TABLE "visitors"
      ADD COLUMN IF NOT EXISTS "total_requests" integer DEFAULT 0 NOT NULL;
    `);
    console.log('✓ visitors.total_requests column ensured');
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
