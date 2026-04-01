/**
 * Multi-user frequency cap load test: 3 shared end users × 15 requests each vs `specific_count` 10.
 * Per campaign type: ads, popup, notification, redirect.
 *
 * Each user's requests are sequential (avoids parallel race past the cap). Users in a batch run in parallel.
 *
 * Opt-in: EXTENSION_INTEGRATION=1 + live base URL (see tests/support/extension-test-base-url.ts).
 */
import { describe, it, expect } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { postExtensionAdBlock } from '../../support/extension-ad-block-request';
import { registerOrLoginExtensionEndUser } from '../../support/extension-register-or-login';
import {
  EXTENSION_INTEGRATION_PASSWORD,
  EXTENSION_SHARED_USER_EMAILS,
} from '../../support/extension-test-constants';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';
import { database as db } from '@/db';
import {
  ads,
  campaigns,
  enduserEvents,
  notifications,
  platforms,
  redirects,
  user,
} from '@/db/schema';

const BASE = extensionIntegrationBaseUrl();
const integration = BASE ? describe : describe.skip;

const TOTAL_USERS = 3;
const BATCH_SIZE = 3;
const REQUESTS_PER_USER = 15;
const FREQUENCY_COUNT = 10;
const DEFAULT_TIMEOUT_MS = 300_000;

type CampaignKind = 'ads' | 'popup' | 'notification' | 'redirect';

type UserResult = {
  email: string;
  endUserId: string;
  servedCount: number;
  expectedCount: number;
  passed: boolean;
};

function syntheticIp(batchIndex: number, indexInBatch: number): string {
  return `10.${batchIndex + 1}.${indexInBatch + 1}.42`;
}

function printSummary(
  label: CampaignKind,
  results: UserResult[],
  eventTypeExpected: string,
  campaignId: string
): void {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n=== FREQUENCY LOAD TEST: ${label} ===`);
  console.log(
    `Users: ${results.length} | Requests/user: ${REQUESTS_PER_USER} | Frequency cap: ${FREQUENCY_COUNT}`
  );
  console.log(`--- RESULTS ---`);
  console.log(`Passed: ${passed}/${results.length}`);
  if (failed === 0) {
    console.log(`All users correctly capped at ${FREQUENCY_COUNT} deliveries.`);
  } else {
    console.log(`FAILED users (${failed}):`);
    for (const r of results.filter((r) => !r.passed).slice(0, 50)) {
      console.log(`  ${r.email}: served ${r.servedCount} (expected ${r.expectedCount})`);
    }
    if (failed > 50) {
      console.log(`  ... and ${failed - 50} more`);
    }
  }
  console.log(`--- DB VERIFICATION (campaign ${campaignId.slice(0, 8)}…) ---`);
  console.log(`Expected event type: ${eventTypeExpected}`);
}

async function ensureCreatorUser(suffix: string): Promise<{
  creatorUserId: string;
  createdCreatorUserId: string | null;
}> {
  const existingCreator = await db.select({ id: user.id }).from(user).limit(1);
  let creatorUserId = existingCreator[0]?.id ?? null;
  let createdCreatorUserId: string | null = null;
  if (!creatorUserId) {
    creatorUserId = `vitest-creator-freqload-${suffix}`;
    await db.insert(user).values({
      id: creatorUserId,
      email: `vitest.creator.freqload.${suffix}@example.test`,
      name: 'Vitest Creator',
      emailVerified: true,
      role: 'admin',
    });
    createdCreatorUserId = creatorUserId;
  }
  return { creatorUserId: creatorUserId!, createdCreatorUserId };
}

type SetupRow = {
  campaignId: string;
  platformDomain: string | null;
  /** ads / popup: ad name; notification: title; redirect: destination URL */
  matchValue: string;
};

async function insertCampaignFixture(
  kind: CampaignKind,
  suffix: string,
  creatorUserId: string
): Promise<{
  setup: SetupRow;
  platformIds: string[];
  adId?: string;
  notificationId?: string;
  redirectId?: string;
}> {
  const platformDomain = `${kind}-load-${suffix}.invalid`;

  if (kind === 'ads') {
    const [plat] = await db
      .insert(platforms)
      .values({
        name: `Vitest freq load ads ${suffix}`,
        domain: platformDomain,
      })
      .returning({ id: platforms.id });
    const platformId = plat!.id;
    const [adRow] = await db
      .insert(ads)
      .values({
        name: `Vitest FreqLoad Ad ${suffix}`,
        description: 'load test',
        targetUrl: 'https://example.test/freqload-ad',
      })
      .returning({ id: ads.id, name: ads.name });
    const [camp] = await db
      .insert(campaigns)
      .values({
        name: `Vitest FreqLoad ads ${suffix}`,
        targetAudience: 'all_users',
        campaignType: 'ads',
        frequencyType: 'specific_count',
        frequencyCount: FREQUENCY_COUNT,
        status: 'active',
        adId: adRow!.id,
        platformIds: [platformId],
        countryCodes: [],
        createdBy: creatorUserId,
      })
      .returning({ id: campaigns.id });
    return {
      setup: { campaignId: camp!.id, platformDomain, matchValue: adRow!.name },
      platformIds: [platformId],
      adId: adRow!.id,
    };
  }

  if (kind === 'popup') {
    const [plat] = await db
      .insert(platforms)
      .values({
        name: `Vitest freq load popup ${suffix}`,
        domain: platformDomain,
      })
      .returning({ id: platforms.id });
    const platformId = plat!.id;
    const [adRow] = await db
      .insert(ads)
      .values({
        name: `Vitest FreqLoad Popup ${suffix}`,
        description: 'load test popup',
        targetUrl: 'https://example.test/freqload-popup',
      })
      .returning({ id: ads.id, name: ads.name });
    const [camp] = await db
      .insert(campaigns)
      .values({
        name: `Vitest FreqLoad popup ${suffix}`,
        targetAudience: 'all_users',
        campaignType: 'popup',
        frequencyType: 'specific_count',
        frequencyCount: FREQUENCY_COUNT,
        status: 'active',
        adId: adRow!.id,
        platformIds: [platformId],
        countryCodes: [],
        createdBy: creatorUserId,
      })
      .returning({ id: campaigns.id });
    return {
      setup: { campaignId: camp!.id, platformDomain, matchValue: adRow!.name },
      platformIds: [platformId],
      adId: adRow!.id,
    };
  }

  if (kind === 'notification') {
    const [notif] = await db
      .insert(notifications)
      .values({
        title: `Vitest FreqLoad Notif ${suffix}`,
        message: 'load test notification',
        ctaLink: 'https://example.test/freqload-notif',
      })
      .returning({ id: notifications.id, title: notifications.title });
    const [camp] = await db
      .insert(campaigns)
      .values({
        name: `Vitest FreqLoad notification ${suffix}`,
        targetAudience: 'all_users',
        campaignType: 'notification',
        frequencyType: 'specific_count',
        frequencyCount: FREQUENCY_COUNT,
        status: 'active',
        notificationId: notif!.id,
        platformIds: [],
        countryCodes: [],
        createdBy: creatorUserId,
      })
      .returning({ id: campaigns.id });
    return {
      setup: { campaignId: camp!.id, platformDomain: null, matchValue: notif!.title },
      platformIds: [],
      notificationId: notif!.id,
    };
  }

  const [platR] = await db
    .insert(platforms)
    .values({
      name: `Vitest freq load redirect ${suffix}`,
      domain: platformDomain,
    })
    .returning({ id: platforms.id });
  const platformId = platR!.id;

  const destinationUrl = `https://example.test/freqload-redir-${suffix}`;
  const [redir] = await db
    .insert(redirects)
    .values({
      name: `Vitest FreqLoad Redirect ${suffix}`,
      sourceDomain: platformDomain,
      includeSubdomains: false,
      destinationUrl,
    })
    .returning({ id: redirects.id });
  const [camp] = await db
    .insert(campaigns)
    .values({
      name: `Vitest FreqLoad redirect ${suffix}`,
      targetAudience: 'all_users',
      campaignType: 'redirect',
      frequencyType: 'specific_count',
      frequencyCount: FREQUENCY_COUNT,
      status: 'active',
      redirectId: redir!.id,
      platformIds: [platformId],
      countryCodes: [],
      createdBy: creatorUserId,
    })
    .returning({ id: campaigns.id });
  return {
    setup: { campaignId: camp!.id, platformDomain, matchValue: destinationUrl },
    platformIds: [platformId],
    redirectId: redir!.id,
  };
}

function countServedInResponse(
  kind: CampaignKind,
  body: {
    ads?: Array<{ title?: string; displayAs?: string }>;
    notifications?: Array<{ title?: string }>;
    redirects?: Array<{ destinationUrl?: string }>;
  },
  matchValue: string
): boolean {
  if (kind === 'ads') {
    return (body.ads ?? []).some((a) => a?.title === matchValue);
  }
  if (kind === 'popup') {
    return (body.ads ?? []).some(
      (a) => a?.title === matchValue && a?.displayAs === 'popup'
    );
  }
  if (kind === 'notification') {
    return (body.notifications ?? []).some((n) => n?.title === matchValue);
  }
  return (body.redirects ?? []).some((r) => r.destinationUrl === matchValue);
}

async function registerAndLogin(email: string): Promise<{ token: string; endUserId: string }> {
  return registerOrLoginExtensionEndUser(BASE!, email, EXTENSION_INTEGRATION_PASSWORD);
}

async function runOneUser(
  kind: CampaignKind,
  userIndex: number,
  batchIndex: number,
  indexInBatch: number,
  setup: SetupRow
): Promise<UserResult> {
  const email = EXTENSION_SHARED_USER_EMAILS[userIndex];
  const { token: initialToken, endUserId } = await registerAndLogin(email);
  const session = { token: initialToken };
  const fwd = syntheticIp(batchIndex, indexInBatch);

  let servedCount = 0;
  for (let r = 0; r < REQUESTS_PER_USER; r++) {
    const payload =
      kind === 'notification'
        ? { requestType: 'notification' as const }
        : { domain: setup.platformDomain!, requestType: 'ad' as const };

    const blockRes = await postExtensionAdBlock(
      BASE!,
      email,
      EXTENSION_INTEGRATION_PASSWORD,
      session,
      payload,
      {
        'user-agent': 'vitest-frequency-load',
        'x-forwarded-for': fwd,
      }
    );
    expect(blockRes.status).toBe(200);
    const blockJson = (await blockRes.json()) as Parameters<typeof countServedInResponse>[1];
    if (countServedInResponse(kind, blockJson, setup.matchValue)) {
      servedCount += 1;
    }
  }

  const passed = servedCount === FREQUENCY_COUNT;
  return {
    email,
    endUserId,
    servedCount,
    expectedCount: FREQUENCY_COUNT,
    passed,
  };
}

async function verifyDbEventTypes(
  endUserIds: string[],
  campaignId: string,
  expectedType: string
): Promise<{ totalRows: number; wrongType: number }> {
  const rows = await db
    .select({ type: enduserEvents.type })
    .from(enduserEvents)
    .where(
      and(inArray(enduserEvents.endUserId, endUserIds), eq(enduserEvents.campaignId, campaignId))
    );
  const wrongType = rows.filter((row) => row.type !== expectedType).length;
  return { totalRows: rows.length, wrongType };
}

async function runFrequencyLoadTest(kind: CampaignKind): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const endUserIds: string[] = [];
  const { creatorUserId, createdCreatorUserId } = await ensureCreatorUser(suffix);
  const { setup, platformIds } = await insertCampaignFixture(
    kind,
    suffix,
    creatorUserId
  );

  const eventTypeExpected =
    kind === 'ads' ? 'ad' : kind === 'popup' ? 'popup' : kind === 'notification' ? 'notification' : 'redirect';

  const numBatches = Math.ceil(TOTAL_USERS / BATCH_SIZE);
  const results: UserResult[] = [];

  try {
    console.log(`\n>>> Starting ${kind}: ${TOTAL_USERS} users in ${numBatches} batches`);

    for (let b = 0; b < numBatches; b++) {
      const start = b * BATCH_SIZE;
      const count = Math.min(BATCH_SIZE, TOTAL_USERS - start);
      const t0 = Date.now();
      console.log(`Batch ${b + 1}/${numBatches} (${count} users) ...`);

      const batchResults = await Promise.all(
        Array.from({ length: count }, (_, i) => {
          const globalIdx = start + i;
          return runOneUser(kind, globalIdx, b, i, setup);
        })
      );

      for (const r of batchResults) {
        endUserIds.push(r.endUserId);
        results.push(r);
      }

      console.log(`  → done (${((Date.now() - t0) / 1000).toFixed(2)}s)`);
    }

    printSummary(kind, results, eventTypeExpected, setup.campaignId);

    const failed = results.filter((r) => !r.passed);
    expect(failed).toHaveLength(0);

    const expectedTotalEvents = TOTAL_USERS * FREQUENCY_COUNT;
    const { totalRows, wrongType } = await verifyDbEventTypes(endUserIds, setup.campaignId, eventTypeExpected);

    console.log(`Total event rows: ${totalRows} (expected: ${expectedTotalEvents})`);
    console.log(
      `All events type '${eventTypeExpected}': ${wrongType === 0 ? 'YES' : `NO (${wrongType} wrong)`}`
    );

    expect(totalRows).toBe(expectedTotalEvents);
    expect(wrongType).toBe(0);
  } finally {
    if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
      return;
    }

    if (endUserIds.length > 0) {
      await db.delete(enduserEvents).where(inArray(enduserEvents.endUserId, endUserIds));
    }
    await db
      .update(campaigns)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(campaigns.id, setup.campaignId));

    if (platformIds.length > 0) {
      await db.delete(platforms).where(inArray(platforms.id, platformIds));
    }
    // Keep ads / notifications / redirects rows (campaign still references them after soft-delete).

    if (createdCreatorUserId) {
      await db.delete(user).where(eq(user.id, createdCreatorUserId));
    }
  }
}

integration('extension multi-user frequency load (3 users × 15 req, cap 10)', () => {
  // Run one campaign type at a time: parallel test execution would overload the API and distort results.
  describe.sequential('per campaign type', () => {
    it('ads: each user capped at 10 deliveries', { timeout: DEFAULT_TIMEOUT_MS }, async () => {
      await runFrequencyLoadTest('ads');
    });

    it('popup: each user capped at 10 deliveries', { timeout: DEFAULT_TIMEOUT_MS }, async () => {
      await runFrequencyLoadTest('popup');
    });

    it('notification: each user capped at 10 deliveries', { timeout: DEFAULT_TIMEOUT_MS }, async () => {
      await runFrequencyLoadTest('notification');
    });

    it('redirect: each user capped at 10 deliveries', { timeout: DEFAULT_TIMEOUT_MS }, async () => {
      await runFrequencyLoadTest('redirect');
    });
  });
});
