#!/usr/bin/env npx tsx
/**
 * Truncate extension end users and enduser events for test resets.
 * Also clears dependent rows via CASCADE (for example: enduser_sessions, payments).
 *
 * Run: npx tsx scripts/truncate-endusers-and-events.ts
 */
import postgres from 'postgres';

import { loadCliEnv } from '../src/lib/db/load-cli-env';

loadCliEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Add it to .env or .env.local, or export it.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe('TRUNCATE TABLE enduser_events, end_users RESTART IDENTITY CASCADE');
    });
    console.log('✓ end_users and enduser_events truncated (dependent tables cleared with CASCADE)');
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
