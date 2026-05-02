#!/usr/bin/env npx tsx
/**
 * Reset live extension connection leases in Redis (sorted set of SSE sessions).
 * Use when the dashboard shows an incorrect count (e.g. drift after deploy).
 *
 * Run: npx tsx scripts/reset-live-count.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { resetConnectionCount } = await import('../src/lib/redis');
  await resetConnectionCount();
  console.log('✓ Live connection leases cleared (count reset to 0)');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
