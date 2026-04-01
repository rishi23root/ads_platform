/**
 * Hits a running Next app + database. Opt-in via `EXTENSION_INTEGRATION=1` (see `pnpm test:integration`).
 * Host resolution: `tests/support/extension-test-base-url.ts` (`BETTER_AUTH_BASE_URL` / `BETTER_AUTH_URL`, optional override).
 */
import { describe, it, expect } from 'vitest';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';

const BASE = extensionIntegrationBaseUrl();

const integration = BASE ? describe : describe.skip;

integration('extension user HTTP flow (register → login → domains → ad-block)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `vitest.ext.${suffix}@example.test`;
  const password = 'VitestExtensionFlow!99';

  it('register returns token + user', async () => {
    const res = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { token?: string; user?: { id?: string; email?: string | null } };
    expect(data.token && data.token.length > 16).toBe(true);
    expect(data.user?.email).toBe(email.toLowerCase());
  });

  it('login returns token', async () => {
    const res = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { token?: string };
    expect(data.token && data.token.length > 16).toBe(true);
  });

  it('domains list is JSON', async () => {
    const res = await fetch(`${BASE}/api/extension/domains`);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { domains?: unknown };
    expect(Array.isArray(data.domains)).toBe(true);
  });

  it('ad-block returns ads + notifications arrays', async () => {
    const loginRes = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.ok).toBe(true);
    const { token } = (await loginRes.json()) as { token: string };

    const domRes = await fetch(`${BASE}/api/extension/domains`);
    const domJson = (await domRes.json()) as { domains: string[] };
    const domain =
      domJson.domains?.[0]?.trim() || 'example.com';

    const blockRes = await fetch(`${BASE}/api/extension/ad-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'user-agent': 'vitest-extension-integration',
      },
      body: JSON.stringify({ domain, requestType: 'ad' }),
    });
    expect(blockRes.status).toBe(200);
    const body = (await blockRes.json()) as { ads: unknown[]; notifications: unknown[] };
    expect(Array.isArray(body.ads)).toBe(true);
    expect(Array.isArray(body.notifications)).toBe(true);
  });
});

describe('extension integration env', () => {
  it('documents how to run integration tests', () => {
    if (BASE) {
      expect(BASE.startsWith('http')).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
