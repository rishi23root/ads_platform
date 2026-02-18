#!/usr/bin/env npx tsx
/**
 * Truncate visitors, request_logs, and campaign_logs tables (remove all data, keep tables).
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
    await sql.unsafe('TRUNCATE TABLE request_logs');
    console.log('✓ request_logs truncated');
    await sql.unsafe('TRUNCATE TABLE visitors');
    console.log('✓ visitors truncated');
    await sql.unsafe('TRUNCATE TABLE campaign_logs');
    console.log('✓ campaign_logs truncated');
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
