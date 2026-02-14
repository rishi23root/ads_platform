#!/usr/bin/env npx tsx
/**
 * Load test script: simulates extension requests
 *
 * - 10 users (unique visitorIds)
 * - 10 requests per minute per user
 * - Runs for 10 minutes
 * - Total: 1000 requests
 *
 * Usage:
 *   pnpm tsx scripts/load-test-extension.ts
 *   BASE_URL=https://your-server.com pnpm tsx scripts/load-test-extension.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const NUM_USERS = 10;
const REQUESTS_PER_MINUTE = 10;
const DURATION_MINUTES = 10;

// Domains to simulate (extension fetches ads per domain)
const DOMAINS = [
  'example.com',
  'instagram.com',
  'facebook.com',
  'youtube.com',
  'twitter.com',
  'linkedin.com',
  'reddit.com',
  'amazon.com',
  'google.com',
  'github.com',
];

interface Stats {
  total: number;
  success: number;
  failed: number;
  errors: Record<string, number>;
}

const globalStats: Stats = {
  total: 0,
  success: 0,
  failed: 0,
  errors: {},
};

function recordResult(ok: boolean, status?: number) {
  globalStats.total++;
  if (ok) {
    globalStats.success++;
  } else {
    globalStats.failed++;
    const key = status ? `HTTP ${status}` : 'network/parse';
    globalStats.errors[key] = (globalStats.errors[key] || 0) + 1;
  }
}

async function makeAdBlockRequest(visitorId: string, domain: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        domain,
        requestType: Math.random() > 0.5 ? 'ad' : undefined, // mix of ad-only and both
      }),
    });
    const ok = res.ok;
    recordResult(ok, res.status);
    return ok;
  } catch {
    recordResult(false);
    return false;
  }
}

async function runUser(userIndex: number): Promise<void> {
  const visitorId = `load-test-user-${userIndex}-${Date.now()}`;
  const intervalMs = (60 * 1000) / REQUESTS_PER_MINUTE; // 6 seconds for 10 req/min

  const endAt = Date.now() + DURATION_MINUTES * 60 * 1000;
  let count = 0;

  while (Date.now() < endAt) {
    const domain = DOMAINS[count % DOMAINS.length];
    await makeAdBlockRequest(visitorId, domain);
    count++;

    if (Date.now() < endAt) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

function printStats() {
  console.log('\n--- Stats ---');
  console.log(`Total: ${globalStats.total}`);
  console.log(`Success: ${globalStats.success}`);
  console.log(`Failed: ${globalStats.failed}`);
  if (Object.keys(globalStats.errors).length > 0) {
    console.log('Errors:', globalStats.errors);
  }
}

async function main() {
  console.log('Extension load test');
  console.log('==================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Users: ${NUM_USERS}`);
  console.log(`Requests per user per minute: ${REQUESTS_PER_MINUTE}`);
  console.log(`Duration: ${DURATION_MINUTES} minutes`);
  console.log(`Expected total: ~${NUM_USERS * REQUESTS_PER_MINUTE * DURATION_MINUTES} requests`);
  console.log('');

  const start = Date.now();

  const progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 60000);
    console.log(`[${elapsed}/${DURATION_MINUTES} min] Requests: ${globalStats.total} (ok: ${globalStats.success}, fail: ${globalStats.failed})`);
  }, 60000);

  const userPromises = Array.from({ length: NUM_USERS }, (_, i) => runUser(i));
  await Promise.all(userPromises);

  clearInterval(progressInterval);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s`);
  printStats();
}

main().catch((err) => {
  console.error(err);
  printStats();
  process.exit(1);
});
