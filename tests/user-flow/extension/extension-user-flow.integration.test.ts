/**
 * Hits a running Next app + database. Opt-in via `EXTENSION_INTEGRATION=1` (see `pnpm test:integration`).
 * Host resolution: `tests/support/extension-test-base-url.ts` (`BETTER_AUTH_BASE_URL` / `BETTER_AUTH_URL`, optional override).
 */
import { describe, it, expect } from 'vitest';
import { registerOrLoginExtensionEndUser } from '../../support/extension-register-or-login';
import {
  EXTENSION_INTEGRATION_LOGIN_HEADERS,
  EXTENSION_INTEGRATION_PASSWORD,
  EXTENSION_SHARED_USER_EMAILS,
} from '../../support/extension-test-constants';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';

const BASE = extensionIntegrationBaseUrl();

const integration = BASE ? describe : describe.skip;

integration('extension user HTTP flow (register → login → ad-block)', () => {
  const email = EXTENSION_SHARED_USER_EMAILS[0];
  const password = EXTENSION_INTEGRATION_PASSWORD;

  it('register or existing login returns token + user', async () => {
    const { token, endUserId } = await registerOrLoginExtensionEndUser(BASE!, email, password);
    expect(token.length > 16).toBe(true);
    expect(endUserId.length > 0).toBe(true);
  });

  it('login returns token', async () => {
    const res = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { ...EXTENSION_INTEGRATION_LOGIN_HEADERS },
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { token?: string };
    expect(data.token && data.token.length > 16).toBe(true);
  });

  it('GET /api/extension/domains returns 404 (removed — use SSE init.domains)', async () => {
    const res = await fetch(`${BASE}/api/extension/domains`);
    expect(res.status).toBe(404);
  });

  it('ad-block returns ads + notifications arrays', async () => {
    const loginRes = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { ...EXTENSION_INTEGRATION_LOGIN_HEADERS },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.ok).toBe(true);
    const { token } = (await loginRes.json()) as { token: string };

    // Domain obtained from a seeded platform or a safe fallback; extensions should use
    // init.domains from the SSE connection rather than the now-removed /api/extension/domains.
    const domain = 'example.com';

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
    const body = (await blockRes.json()) as {
      ads: unknown[];
      notifications: unknown[];
      redirects: unknown[];
    };
    expect(Array.isArray(body.ads)).toBe(true);
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(Array.isArray(body.redirects)).toBe(true);
  });

  it('ad-block with requestType notification omits domain and returns empty ads', async () => {
    const loginRes = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { ...EXTENSION_INTEGRATION_LOGIN_HEADERS },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.ok).toBe(true);
    const { token } = (await loginRes.json()) as { token: string };

    const blockRes = await fetch(`${BASE}/api/extension/ad-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'user-agent': 'vitest-extension-integration',
      },
      body: JSON.stringify({ requestType: 'notification' }),
    });
    expect(blockRes.status).toBe(200);
    const body = (await blockRes.json()) as {
      ads: unknown[];
      notifications: unknown[];
      redirects: unknown[];
    };
    expect(Array.isArray(body.ads)).toBe(true);
    expect(body.ads).toHaveLength(0);
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(Array.isArray(body.redirects)).toBe(true);
    expect(body.redirects).toHaveLength(0);
  });

  it('ad-block rejects ad request without domain (400)', async () => {
    const loginRes = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { ...EXTENSION_INTEGRATION_LOGIN_HEADERS },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.ok).toBe(true);
    const { token } = (await loginRes.json()) as { token: string };

    const blockRes = await fetch(`${BASE}/api/extension/ad-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'user-agent': 'vitest-extension-integration',
      },
      body: JSON.stringify({ requestType: 'ad' }),
    });
    expect(blockRes.status).toBe(400);
    const err = (await blockRes.json()) as { error?: string };
    expect(err.error).toBe('Validation failed');
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
