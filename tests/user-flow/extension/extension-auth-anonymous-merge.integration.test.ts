/**
 * Anonymous register idempotency, in-place email upgrade (same end_users.id), and login+identifier consolidation.
 * Opt-in: EXTENSION_INTEGRATION=1 and base URL (see extension-test-base-url.ts).
 */
import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, enduserEvents } from '@/db/schema';
import {
  EXTENSION_INTEGRATION_LOGIN_HEADERS,
  EXTENSION_INTEGRATION_PASSWORD,
} from '../../support/extension-test-constants';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';

const BASE = extensionIntegrationBaseUrl();
const integration = BASE ? describe : describe.skip;

function randomKey(suffix: string): string {
  return `vitest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${suffix}`;
}

integration('extension auth: anonymous idempotency and link-email (same end_users id)', () => {
  it('identifier-only register returns 201 then 200 for the same device id', async () => {
    const identifier = randomKey('idemp');
    const init = { method: 'POST' as const, headers: { 'Content-Type': 'application/json' } };

    const r1 = await fetch(`${BASE}/api/extension/auth/register`, {
      ...init,
      body: JSON.stringify({ identifier }),
    });
    expect(r1.status).toBe(201);
    const j1 = (await r1.json()) as { user: { id: string } };

    const r2 = await fetch(`${BASE}/api/extension/auth/register`, {
      ...init,
      body: JSON.stringify({ identifier }),
    });
    expect(r2.status).toBe(200);
    const j2 = (await r2.json()) as { user: { id: string } };

    expect(j2.user.id).toBe(j1.user.id);
  });

  it('login with identifier keeps anonymous uuid and moves email account data onto that row', async () => {
    const identifier = randomKey('merge');
    const email = `${randomKey('email').replace(/_/g, '')}@integration.example`;

    const anonReg = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    expect(anonReg.status).toBe(201);
    const anonJson = (await anonReg.json()) as { token: string; user: { id: string } };
    const anonUserId = anonJson.user.id;

    const evRes = await fetch(`${BASE}/api/extension/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonJson.token}`,
      },
      body: JSON.stringify({
        events: [{ type: 'visit', domain: 'merge-test.example' }],
      }),
    });
    expect(evRes.status).toBe(200);

    const emailReg = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: EXTENSION_INTEGRATION_PASSWORD }),
    });
    expect(emailReg.status).toBe(201);
    const emailJson = (await emailReg.json()) as { user: { id: string; identifier: string } };
    const emailUserId = emailJson.user.id;
    const emailUserIdentifier = emailJson.user.identifier;
    expect(emailUserId).not.toBe(anonUserId);

    const loginRes = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { ...EXTENSION_INTEGRATION_LOGIN_HEADERS },
      body: JSON.stringify({
        email,
        password: EXTENSION_INTEGRATION_PASSWORD,
        identifier,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginJson = (await loginRes.json()) as { user: { id: string; email: string | null } };
    expect(loginJson.user.id).toBe(anonUserId);
    expect(loginJson.user.email).toBe(email.toLowerCase());

    const emailOnlyRows = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.id, emailUserId));
    expect(emailOnlyRows.length).toBe(0);

    const upgraded = await db.select().from(endUsers).where(eq(endUsers.id, anonUserId)).limit(1);
    expect(upgraded.length).toBe(1);
    expect(upgraded[0]!.email).toBe(email.toLowerCase());

    const visitsForDevice = await db
      .select()
      .from(enduserEvents)
      .where(
        and(eq(enduserEvents.userIdentifier, identifier), eq(enduserEvents.domain, 'merge-test.example'))
      );
    expect(visitsForDevice.some((e) => e.type === 'visit')).toBe(true);

    const orphanEvents = await db
      .select()
      .from(enduserEvents)
      .where(eq(enduserEvents.userIdentifier, emailUserIdentifier));
    expect(orphanEvents.length).toBe(0);
  });

  it('register email+password+identifier upgrades existing anonymous row in place', async () => {
    const identifier = randomKey('regup');
    const email = `${randomKey('regmail').replace(/_/g, '')}@integration.example`;

    const anonReg = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    expect(anonReg.status).toBe(201);
    const anonJson = (await anonReg.json()) as { user: { id: string } };
    const anonUserId = anonJson.user.id;

    const upReg = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: EXTENSION_INTEGRATION_PASSWORD,
        identifier,
      }),
    });
    expect(upReg.status).toBe(201);
    const upJson = (await upReg.json()) as { user: { id: string; email: string | null } };
    expect(upJson.user.id).toBe(anonUserId);
    expect(upJson.user.email).toBe(email.toLowerCase());

    const rowsWithEmail = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.email, email.toLowerCase()));
    expect(rowsWithEmail.length).toBe(1);
    expect(rowsWithEmail[0]!.id).toBe(anonUserId);
  });

  it('identifier-only register returns 200 for existing email-backed row on that device id (no new ext_ user)', async () => {
    const identifier = randomKey('occupied-anon');
    const email = `${randomKey('occ').replace(/_/g, '')}@integration.example`;

    const emailFirst = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: EXTENSION_INTEGRATION_PASSWORD,
        identifier,
      }),
    });
    expect(emailFirst.status).toBe(201);
    const emailFirstJson = (await emailFirst.json()) as {
      user: { id: string; identifier: string | null };
      identifierRegenerated?: boolean;
    };
    expect(emailFirstJson.user.identifier).toBe(identifier);

    const anonSecond = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    expect(anonSecond.status).toBe(200);
    const anonSecondJson = (await anonSecond.json()) as {
      user: { id: string; identifier: string | null };
      identifierRegenerated?: boolean;
    };
    expect(anonSecondJson.identifierRegenerated).toBeUndefined();
    expect(anonSecondJson.user.identifier).toBe(identifier);
    expect(anonSecondJson.user.id).toBe(emailFirstJson.user.id);
  });

  it('email register returns 409 when device id is owned by a different email account', async () => {
    const identifier = randomKey('occ-email');
    const emailA = `${randomKey('a').replace(/_/g, '')}@integration.example`;
    const emailB = `${randomKey('b').replace(/_/g, '')}@integration.example`;

    const regA = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailA,
        password: EXTENSION_INTEGRATION_PASSWORD,
        identifier,
      }),
    });
    expect(regA.status).toBe(201);

    const regB = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailB,
        password: EXTENSION_INTEGRATION_PASSWORD,
        identifier,
      }),
    });
    expect(regB.status).toBe(409);
    const jB = (await regB.json()) as { error?: string };
    expect(jB.error).toBe('This device is linked to a different account');
  });

  it('login echoes canonical identifier and identifierReplaced when client device id differs from stored', async () => {
    const email = `${randomKey('idrep').replace(/_/g, '')}@integration.example`;
    const reg = await fetch(`${BASE}/api/extension/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: EXTENSION_INTEGRATION_PASSWORD,
      }),
    });
    expect(reg.status).toBe(201);
    const regJson = (await reg.json()) as { user: { identifier: string } };
    expect(regJson.user.identifier.length).toBeGreaterThan(8);

    const wrongLocalId = randomKey('wronglocal');
    const loginRes = await fetch(`${BASE}/api/extension/auth/login`, {
      method: 'POST',
      headers: { ...EXTENSION_INTEGRATION_LOGIN_HEADERS },
      body: JSON.stringify({
        email,
        password: EXTENSION_INTEGRATION_PASSWORD,
        identifier: wrongLocalId,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginJson = (await loginRes.json()) as {
      user: { identifier: string | null };
      identifier: string | null;
      identifierReplaced?: boolean;
    };
    expect(loginJson.identifier).toBe(loginJson.user.identifier);
    expect(loginJson.identifierReplaced).toBe(true);
    expect(loginJson.identifier).toBe(regJson.user.identifier);
  });
});
