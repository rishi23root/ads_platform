/**
 * Extension v2: GET /api/extension/live, POST /serve, POST /events.
 * Redirect rules: SSE `init.redirects` and `redirects_updated` only.
 * Opt-in: EXTENSION_INTEGRATION=1 and base URL (see extension-test-base-url.ts).
 */
import { describe, it, expect } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { database as db } from '@/db';
import { enduserEvents } from '@/db/schema';
import { postExtensionEvents } from '../../support/extension-events-request';
import { postExtensionServe } from '../../support/extension-serve-ads-request';
import { fetchExtensionLiveFirstSseEvent } from '../../support/extension-sse-first-event';
import { registerOrLoginExtensionEndUser } from '../../support/extension-register-or-login';
import {
  EXTENSION_INTEGRATION_PASSWORD,
  EXTENSION_SHARED_USER_EMAILS,
} from '../../support/extension-test-constants';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';

const BASE = extensionIntegrationBaseUrl();
const integration = BASE ? describe : describe.skip;

integration('extension v2 HTTP (live SSE, serve, events)', () => {
  const email = EXTENSION_SHARED_USER_EMAILS[0];
  const password = EXTENSION_INTEGRATION_PASSWORD;

  it('GET /api/extension/live without auth returns 401', async () => {
    const res = await fetch(`${BASE}/api/extension/live`, {
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.status).toBe(401);
  });

  it('SSE first frame is event init with domains and redirects (no platforms/campaigns/frequencyCounts)', async () => {
    const { token } = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const frame = await fetchExtensionLiveFirstSseEvent(BASE!, token);
    expect(frame.ok).toBe(true);
    expect(frame.eventName).toBe('init');
    const payload = JSON.parse(frame.data) as Record<string, unknown>;
    expect(payload.user).toBeTruthy();
    expect(Array.isArray(payload.domains)).toBe(true);
    expect(Array.isArray(payload.redirects)).toBe(true);
    expect(payload.platforms).toBeUndefined();
    expect(payload.campaigns).toBeUndefined();
    expect(payload.frequencyCounts).toBeUndefined();
  });

  it('POST /api/extension/serve rejects missing domain (400)', async () => {
    const session = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const res = await fetch(`${BASE}/api/extension/serve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/extension/serve returns ads, popups, and notifications arrays', async () => {
    const session = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const res = await postExtensionServe(
      BASE!,
      email,
      password,
      { token: session.token },
      { domain: 'example.com' },
      { 'user-agent': 'vitest-extension-v2' }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ads?: unknown[];
      popups?: unknown[];
      notifications?: unknown[];
    };
    expect(Array.isArray(body.ads)).toBe(true);
    expect(Array.isArray(body.popups)).toBe(true);
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(body).not.toHaveProperty('redirects');
  });

  it('POST /api/extension/serve accepts optional type filter', async () => {
    const session = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const res = await postExtensionServe(
      BASE!,
      email,
      password,
      { token: session.token },
      { domain: 'example.com', type: 'notification' },
      { 'user-agent': 'vitest-extension-v2' }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ads?: unknown[];
      popups?: unknown[];
      notifications?: unknown[];
    };
    expect(body.ads).toEqual([]);
    expect(body.popups).toEqual([]);
    expect(Array.isArray(body.notifications)).toBe(true);
    for (const item of body.notifications ?? []) {
      expect(item).toMatchObject({
        id: expect.any(String),
        notification: expect.objectContaining({
          title: expect.any(String),
          message: expect.any(String),
        }),
      });
    }
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
            type: 'redirect',
          },
        ],
      }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/extension/events persists a batch of visit events (5–10 pattern)', async () => {
    const { token, userIdentifier } = await registerOrLoginExtensionEndUser(BASE!, email, password);
    const session = { token };
    const domains = Array.from({ length: 7 }, (_, i) => `vitest-v2-batch-${i}.invalid`);
    let insertedIds: string[] = [];

    try {
      const res = await postExtensionEvents(BASE!, email, password, session, {
        events: [
          ...domains.map((domain) => ({ type: 'visit' as const, domain })),
          {
            type: 'visit',
            domain: 'vitest-v2-batch-timed.invalid',
            visitedAt: '2026-04-01T12:00:00.000Z',
          },
        ],
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(
          `POST /api/extension/events: HTTP ${res.status} (restart/redeploy the app under test so visit events are supported). Body: ${t.slice(0, 900)}`
        );
      }
      expect(res.status).toBe(200);

      const rows = await db
        .select({ id: enduserEvents.id })
        .from(enduserEvents)
        .where(
          and(
            eq(enduserEvents.userIdentifier, userIdentifier),
            eq(enduserEvents.type, 'visit'),
            inArray(enduserEvents.domain, [...domains, 'vitest-v2-batch-timed.invalid'])
          )
        );
      expect(rows).toHaveLength(8);
      insertedIds = rows.map((r) => r.id);
    } finally {
      if (insertedIds.length) {
        await db.delete(enduserEvents).where(inArray(enduserEvents.id, insertedIds));
      }
    }
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
