#!/usr/bin/env npx tsx
/**
 * Load test script: simulates extension requests across multiple domains
 *
 * - Multiple domains (US-focused for country code testing)
 * - 10 requests per domain
 * - Simple user/visitor IDs
 * - Country code from CF/Vercel headers (cf-ipcountry, x-vercel-ip-country)
 *
 * Usage:
 *   BASE_URL=https://your-domain.com pnpm tsx scripts/load-test-extension.ts
 *   pnpm load-test:extension
 *
 * Note: Use a deployed domain behind Cloudflare or Vercel so country is auto-detected.
 */

const BASE_URL = process.env.BASE_URL || 'https://test.buildyourresume.in';
const REQUESTS_PER_DOMAIN = 10;

// Domains to test (page domains the user is visiting)
const DOMAINS = [
  'test.buildyourresume.in',
  'edition.cnn.com',
  'www.instagram.com',
  'example.com',
  'youtube.com',
];

// Simple IDs for testing
const VISITOR_IDS = ['user-1', 'visitor-1'];

interface DomainResult {
  domain: string;
  success: number;
  failed: number;
  responses: Array<{
    request: number;
    status: number;
    adsCount: number;
    notifsCount: number;
    errorBody?: string;
  }>;
}

async function makeAdBlockRequest(
  visitorId: string,
  domain: string,
  logErrors: boolean
): Promise<{ ok: boolean; status: number; adsCount: number; notifsCount: number; errorBody?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        domain,
      }),
    });
    let adsCount = 0;
    let notifsCount = 0;
    let errorBody: string | undefined;
    if (res.ok) {
      const data = await res.json();
      adsCount = Array.isArray(data.ads) ? data.ads.length : 0;
      notifsCount = Array.isArray(data.notifications) ? data.notifications.length : 0;
    } else if (logErrors) {
      const text = await res.text();
      try {
        errorBody = JSON.parse(text)?.error || text;
      } catch {
        errorBody = text.slice(0, 200);
      }
    }
    return { ok: res.ok, status: res.status, adsCount, notifsCount, errorBody };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      adsCount: 0,
      notifsCount: 0,
      errorBody: e instanceof Error ? e.message : String(e),
    };
  }
}

async function testDomain(domain: string): Promise<DomainResult> {
  const result: DomainResult = {
    domain,
    success: 0,
    failed: 0,
    responses: [],
  };

  const visitorId = VISITOR_IDS[DOMAINS.indexOf(domain) % VISITOR_IDS.length];

  for (let i = 0; i < REQUESTS_PER_DOMAIN; i++) {
    const resp = await makeAdBlockRequest(visitorId, domain, result.failed === 0);
    result.responses.push({
      request: i + 1,
      status: resp.status,
      adsCount: resp.adsCount,
      notifsCount: resp.notifsCount,
      errorBody: resp.errorBody,
    });
    if (resp.ok) result.success++;
    else result.failed++;
  }

  return result;
}

function logDomainResult(result: DomainResult) {
  console.log(`\n--- ${result.domain} ---`);
  console.log(`  Success: ${result.success}/${REQUESTS_PER_DOMAIN}, Failed: ${result.failed}`);
  const firstError = result.responses.find((r) => r.errorBody);
  if (firstError?.errorBody) {
    console.log(`  Error (from first failure): ${firstError.errorBody}`);
  }
  for (const r of result.responses) {
    const status = r.status > 0 ? r.status : 'ERR';
    const content = `ads=${r.adsCount} notifs=${r.notifsCount}`;
    console.log(`  Request ${r.request}: HTTP ${status} | ${content}`);
  }
}

async function main() {
  console.log('Extension Load Test (Multi-Domain)');
  console.log('==================================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Domains: ${DOMAINS.join(', ')}`);
  console.log(`Requests per domain: ${REQUESTS_PER_DOMAIN}`);
  console.log(`Visitor IDs: ${VISITOR_IDS.join(', ')}`);
  console.log('(Country from CF/Vercel headers)');
  console.log('');

  const start = Date.now();
  const results: DomainResult[] = [];

  for (const domain of DOMAINS) {
    const result = await testDomain(domain);
    results.push(result);
    logDomainResult(result);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const totalSuccess = results.reduce((s, r) => s + r.success, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  const totalAds = results.reduce(
    (sum, r) => sum + r.responses.reduce((s, resp) => s + resp.adsCount, 0),
    0
  );
  const totalNotifs = results.reduce(
    (sum, r) => sum + r.responses.reduce((s, resp) => s + resp.notifsCount, 0),
    0
  );

  console.log('\n==================================================');
  console.log(`Completed in ${elapsed}s`);
  console.log(`Total: ${totalSuccess} success, ${totalFailed} failed`);
  console.log(`Data received: ${totalAds} ads, ${totalNotifs} notifications`);
  if (totalAds === 0 && totalNotifs === 0 && totalSuccess > 0) {
    console.log('');
    console.log('Tip: To get ads/notifications, add Platforms for these domains');
    console.log('  and create active Campaigns with ads/notifications linked.');
  }
  console.log('==================================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
