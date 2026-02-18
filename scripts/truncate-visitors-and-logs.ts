#!/usr/bin/env npx tsx
/**
 * Truncate visitors table (event-based: one row per serve).
 * Run: npx tsx scripts/truncate-visitors-and-logs.ts
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
    await sql.unsafe('TRUNCATE TABLE visitors ');
    await sql.unsafe('TRUNCATE TABLE notification_reads ');
    console.log('✓ visitors truncated');
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
