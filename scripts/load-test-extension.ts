#!/usr/bin/env npx tsx
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

/**
 * Load test: extension ad-block requests with Bearer auth (multi-domain).
 *
 * Requires extension user credentials (same as POST /api/extension/auth/login):
 *   EXTENSION_EMAIL, EXTENSION_PASSWORD
 *
 * Usage:
 *   EXTENSION_EMAIL=a@b.com EXTENSION_PASSWORD=secret pnpm load-test:extension
 * Host: BASE_URL, or else BETTER_AUTH_BASE_URL / BETTER_AUTH_URL from .env.local (same as app auth).
 */

function resolveBaseUrl(): string {
  return (
    process.env.BASE_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    ''
  );
}

const BASE_URL = resolveBaseUrl();
const REQUESTS_PER_DOMAIN = 10;
const EXTENSION_EMAIL = process.env.EXTENSION_EMAIL?.trim();
const EXTENSION_PASSWORD = process.env.EXTENSION_PASSWORD;

const DOMAINS = [
  'test.buildyourresume.in',
  'edition.cnn.com',
  'www.instagram.com',
  'example.com',
  'youtube.com',
];

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

async function loginExtensionUser(): Promise<string> {
  if (!EXTENSION_EMAIL || !EXTENSION_PASSWORD) {
    throw new Error(
      'Set EXTENSION_EMAIL and EXTENSION_PASSWORD (extension user login). Create user via POST /api/extension/auth/register if needed.'
    );
  }
  const res = await fetch(`${BASE_URL}/api/extension/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EXTENSION_EMAIL, password: EXTENSION_PASSWORD }),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Login HTTP ${res.status}`);
  }
  if (!data.token) {
    throw new Error('Login response missing token');
  }
  return data.token;
}

async function makeAdBlockRequest(
  token: string,
  domain: string,
  logErrors: boolean
): Promise<{ ok: boolean; status: number; adsCount: number; notifsCount: number; errorBody?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ domain }),
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

async function testDomain(token: string, domain: string): Promise<DomainResult> {
  const result: DomainResult = {
    domain,
    success: 0,
    failed: 0,
    responses: [],
  };

  for (let i = 0; i < REQUESTS_PER_DOMAIN; i++) {
    const resp = await makeAdBlockRequest(token, domain, result.failed === 0);
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
  if (!BASE_URL) {
    console.error(
      'Set BASE_URL or BETTER_AUTH_BASE_URL or BETTER_AUTH_URL (e.g. in .env.local) to your dashboard origin.'
    );
    process.exit(1);
  }

  console.log('Extension Load Test (Multi-Domain, Bearer auth)');
  console.log('==================================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Domains: ${DOMAINS.join(', ')}`);
  console.log(`Requests per domain: ${REQUESTS_PER_DOMAIN}`);
  console.log('(Country from CF/Vercel headers when deployed)');
  console.log('');

  const token = await loginExtensionUser();
  console.log('Extension user login OK.\n');

  const start = Date.now();
  const results: DomainResult[] = [];

  for (const domain of DOMAINS) {
    const result = await testDomain(token, domain);
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
