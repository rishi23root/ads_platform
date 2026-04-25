/**
 * SSE (`/api/extension/live`): verify HTTP stream connection metadata and `init` payload
 * after extension login. Uses flat `identifier` from `init` (matches login/device identifier).
 *
 * Run (dev server + DB env required): `pnpm test:sse-live`
 * Or: `EXTENSION_INTEGRATION=1 vitest run tests/user-flow/extension/extension-sse-live-connection.integration.test.ts --no-file-parallelism`
 *
 * If the preflight reports HTTP 502 + HTML, your `BETTER_AUTH_BASE_URL` host is not serving the app
 * (tunnel down, Cloudflare origin error, etc.). While testing locally, set
 * `EXTENSION_INTEGRATION_BASE_URL=http://127.0.0.1:3000` in `.env.local` and run `pnpm dev`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { extensionIntegrationPreflight } from '../../support/extension-integration-preflight';
import { registerOrLoginExtensionEndUser } from '../../support/extension-register-or-login';
import { fetchExtensionLiveSseInitWithHttpMeta } from '../../support/extension-sse-first-event';
import {
  EXTENSION_INTEGRATION_PASSWORD,
  EXTENSION_SHARED_USER_EMAILS,
} from '../../support/extension-test-constants';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';

const BASE = extensionIntegrationBaseUrl();

describe.skipIf(!BASE)('SSE extension live: connection + init data (login → stream)', () => {
  const email = EXTENSION_SHARED_USER_EMAILS[0];
  const password = EXTENSION_INTEGRATION_PASSWORD;

  beforeAll(async () => {
    const p = await extensionIntegrationPreflight(BASE!);
    if (!p.ok) {
      throw new Error(p.reason);
    }
  }, 25_000);

  it('returns 401 without token', async () => {
    const res = await fetch(`${BASE}/api/extension/live`, {
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.status).toBe(401);
  });

  it('connects with text/event-stream, first event init, identifier matches login', async () => {
    const { token, endUserId, userIdentifier } = await registerOrLoginExtensionEndUser(
      BASE!,
      email,
      password
    );

    const meta = await fetchExtensionLiveSseInitWithHttpMeta(BASE!, token);

    expect(meta.ok, `expected SSE ok, got status=${meta.status}`).toBe(true);
    expect(meta.status).toBe(200);
    expect(meta.contentType).toContain('text/event-stream');
    expect(meta.cacheControl ?? '').toContain('no-cache');
    expect(meta.connectionKeepAlive).toBe(true);
    expect(meta.eventName).toBe('init');

    const init = JSON.parse(meta.data) as Record<string, unknown>;

    expect(init.identifier).toBe(userIdentifier);
    expect(init.user).toBeUndefined();
    for (const leaked of ['email', 'plan', 'banned', 'country', 'startDate', 'endDate', 'id', 'name']) {
      expect(init).not.toHaveProperty(leaked);
    }
    expect(Array.isArray(init.domains)).toBe(true);
    expect(Array.isArray(init.redirects)).toBe(true);
    // platforms, campaigns, and frequencyCounts are no longer in init
    expect(init.platforms).toBeUndefined();
    expect(init.campaigns).toBeUndefined();
    expect(init.frequencyCounts).toBeUndefined();

    if (process.env.SSE_LIVE_VERBOSE === '1') {
      console.info('[SSE live test] connection headers:', {
        contentType: meta.contentType,
        connection: meta.connectionHeader,
        cacheControl: meta.cacheControl,
        connectionKeepAlive: meta.connectionKeepAlive,
      });
      console.info('[SSE live test] init (endUserId from login vs identifier on stream):', {
        endUserId,
        identifier: init.identifier,
      });
    }
  });
});

describe('SSE live integration env', () => {
  it('documents EXTENSION_INTEGRATION and base URL for live SSE', () => {
    if (BASE) {
      expect(BASE.startsWith('http')).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
