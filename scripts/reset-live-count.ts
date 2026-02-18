#!/usr/bin/env npx tsx
/**
 * Reset the live extension connection count to 0 in Redis.
 * Use when the dashboard shows an incorrect count (e.g. always 1 with no extension users).
 *
 * Run: npx tsx scripts/reset-live-count.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { resetConnectionCount } = await import('../src/lib/redis');
  await resetConnectionCount();
  console.log('✓ Live connection count reset to 0');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
