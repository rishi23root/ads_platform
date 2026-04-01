/**
 * Extension v2: GET /api/extension/live, POST /serve/ads, POST /events.
 * Opt-in: EXTENSION_INTEGRATION=1 and base URL (see extension-test-base-url.ts).
 */
import { describe, it, expect } from 'vitest';
import { postExtensionEvents } from '../../support/extension-events-request';
import { postExtensionServeAds } from '../../support/extension-serve-ads-request';
import { fetchExtensionLiveFirstSseEvent } from '../../support/extension-sse-first-event';
import { registerOrLoginExtensionEndUser } from '../../support/extension-register-or-login';
import {
  EXTENSION_INTEGRATION_PASSWORD,
  EXTENSION_SHARED_USER_EMAILS,
} from '../../support/extension-test-constants';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';

const BASE = extensionIntegrationBaseUrl();
const integration = BASE ? describe : describe.skip;

integration('extension v2 HTTP (live SSE, serve/ads, events)', () => {
  const email = EXTENSION_SHARED_USER_EMAILS[0];
  const password = EXTENSION_INTEGRATION_PASSWORD;

  it('GET /api/extension/live without auth returns 401', async () => {
    const res = await fetch(`${BASE}/api/extension/live`, {
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.status).toBe(401);
  });

  it('SSE first frame is event init with platforms, campaigns, frequencyCounts', async () => {
    const { token } = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const frame = await fetchExtensionLiveFirstSseEvent(BASE!, token);
    expect(frame.ok).toBe(true);
    expect(frame.eventName).toBe('init');
    const payload = JSON.parse(frame.data) as {
      user?: unknown;
      domains?: unknown;
      platforms?: unknown;
      campaigns?: unknown;
      frequencyCounts?: unknown;
    };
    expect(payload.user).toBeTruthy();
    expect(Array.isArray(payload.domains)).toBe(true);
    expect(Array.isArray(payload.platforms)).toBe(true);
    expect(Array.isArray(payload.campaigns)).toBe(true);
    expect(payload.frequencyCounts && typeof payload.frequencyCounts === 'object').toBe(true);
  });

  it('POST /api/extension/serve/ads rejects missing domain (400)', async () => {
    const session = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const res = await fetch(`${BASE}/api/extension/serve/ads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/extension/serve/ads returns ads array', async () => {
    const session = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const res = await postExtensionServeAds(
      BASE!,
      email,
      password,
      { token: session.token },
      { domain: 'example.com' },
      { 'user-agent': 'vitest-extension-v2' }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ads?: unknown[] };
    expect(Array.isArray(body.ads)).toBe(true);
  });

  it('POST /api/extension/events rejects empty events (400)', async () => {
    const session = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const res = await postExtensionEvents(
      BASE!,
      email,
      password,
      { token: session.token },
      { events: [] }
    );
    expect(res.status).toBe(400);
  });

  it('POST /api/extension/events rejects unauthenticated (401)', async () => {
    const res = await fetch(`${BASE}/api/extension/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            campaignId: '00000000-0000-4000-8000-000000000001',
            domain: 'example.com',
            type: 'notification',
          },
        ],
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe('extension v2 integration env', () => {
  it('documents running v2 HTTP tests with a live server', () => {
    if (BASE) {
      expect(BASE.startsWith('http')).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
