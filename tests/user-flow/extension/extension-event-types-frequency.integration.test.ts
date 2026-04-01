/**
 * Integration test:
 * - Creates an ads campaign and a notification campaign with `specific_count = 10`
 * - Sends 100 extension requests (50 ad + 50 notification)
 * - Verifies each campaign serves exactly 10 times, then is blocked
 * - Verifies DB event rows are typed as expected (`ad` / `notification`) and capped at 10
 *
 * Opt-in via EXTENSION_INTEGRATION=1 and a running app base URL.
 */
import { describe, it, expect } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { extensionIntegrationBaseUrl } from '../../support/extension-test-base-url';
import { database as db } from '@/db';
import {
  ads,
  campaigns,
  endUsers,
  enduserEvents,
  notifications,
  platforms,
  user,
} from '@/db/schema';

const BASE = extensionIntegrationBaseUrl();
const integration = BASE ? describe : describe.skip;

integration('extension ad-block event typing + frequency cap', () => {
  it('caps campaign delivery at 10 and persists typed event rows', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = `vitest.events.${suffix}@example.test`;
    const password = 'VitestEventsCap!99';

    const createdCampaignIds: string[] = [];
    const createdAdIds: string[] = [];
    const createdNotificationIds: string[] = [];
    const createdPlatformIds: string[] = [];
    const testForwardedIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let createdCreatorUserId: string | null = null;
    let endUserId: string | null = null;

    try {
      const existingCreator = await db.select({ id: user.id }).from(user).limit(1);
      let creatorUserId = existingCreator[0]?.id ?? null;
      if (!creatorUserId) {
        creatorUserId = `vitest-creator-${suffix}`;
        await db.insert(user).values({
          id: creatorUserId,
          email: `vitest.creator.${suffix}@example.test`,
          name: 'Vitest Creator',
          emailVerified: true,
          role: 'admin',
        });
        createdCreatorUserId = creatorUserId;
      }

      const existingPlatform = await db
        .select({ id: platforms.id, domain: platforms.domain })
        .from(platforms)
        .limit(1);

      let platformId = existingPlatform[0]?.id ?? null;
      let platformDomain = existingPlatform[0]?.domain?.trim() || null;
      if (!platformId || !platformDomain) {
        const [insertedPlatform] = await db
          .insert(platforms)
          .values({
            name: `Vitest Platform ${suffix}`,
            domain: `events-${suffix}.example.com`,
          })
          .returning({ id: platforms.id, domain: platforms.domain });
        platformId = insertedPlatform?.id ?? null;
        platformDomain = insertedPlatform?.domain?.trim() || null;
        if (platformId) createdPlatformIds.push(platformId);
      }

      expect(creatorUserId).toBeTruthy();
      expect(platformId).toBeTruthy();
      expect(platformDomain).toBeTruthy();

      const [createdAd] = await db
        .insert(ads)
        .values({
          name: `Vitest Ad ${suffix}`,
          description: 'Integration test ad',
          targetUrl: 'https://example.test/ad',
        })
        .returning({ id: ads.id, name: ads.name });
      expect(createdAd?.id).toBeTruthy();
      createdAdIds.push(createdAd.id);

      const [createdNotification] = await db
        .insert(notifications)
        .values({
          title: `Vitest Notification ${suffix}`,
          message: 'Integration test notification',
          ctaLink: 'https://example.test/notification',
        })
        .returning({ id: notifications.id, title: notifications.title });
      expect(createdNotification?.id).toBeTruthy();
      createdNotificationIds.push(createdNotification.id);

      const [adCampaign] = await db
        .insert(campaigns)
        .values({
          name: `Vitest Ads Campaign ${suffix}`,
          targetAudience: 'all_users',
          campaignType: 'ads',
          frequencyType: 'specific_count',
          frequencyCount: 10,
          status: 'active',
          adId: createdAd.id,
          platformIds: [platformId!],
          createdBy: creatorUserId!,
        })
        .returning({ id: campaigns.id });
      expect(adCampaign?.id).toBeTruthy();
      createdCampaignIds.push(adCampaign.id);

      const [notificationCampaign] = await db
        .insert(campaigns)
        .values({
          name: `Vitest Notification Campaign ${suffix}`,
          targetAudience: 'all_users',
          campaignType: 'notification',
          frequencyType: 'specific_count',
          frequencyCount: 10,
          status: 'active',
          notificationId: createdNotification.id,
          platformIds: [],
          createdBy: creatorUserId!,
        })
        .returning({ id: campaigns.id });
      expect(notificationCampaign?.id).toBeTruthy();
      createdCampaignIds.push(notificationCampaign.id);

      const registerRes = await fetch(`${BASE}/api/extension/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(registerRes.status).toBe(201);
      const registerJson = (await registerRes.json()) as { user?: { id?: string | null } };
      endUserId = registerJson.user?.id ?? null;
      expect(endUserId).toBeTruthy();

      const loginRes = await fetch(`${BASE}/api/extension/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(loginRes.status).toBe(200);
      const loginJson = (await loginRes.json()) as { token?: string };
      const token = loginJson.token ?? '';
      expect(token.length > 16).toBe(true);

      let servedAdCount = 0;
      let servedNotificationCount = 0;
      for (let i = 0; i < 100; i++) {
        const isAdRequest = i % 2 === 0;
        const payload = isAdRequest
          ? { domain: platformDomain, requestType: 'ad' as const }
          : { requestType: 'notification' as const };

        const blockRes = await fetch(`${BASE}/api/extension/ad-block`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'user-agent': 'vitest-extension-events-frequency',
            'x-forwarded-for': testForwardedIp,
          },
          body: JSON.stringify(payload),
        });
        expect(blockRes.status).toBe(200);
        const blockJson = (await blockRes.json()) as {
          ads?: Array<{ title?: string }>;
          notifications?: Array<{ title?: string }>;
        };
        const adsPayload = blockJson.ads ?? [];
        const notificationsPayload = blockJson.notifications ?? [];
        const adSeen = adsPayload.some((a) => a?.title === createdAd.name);
        const notificationSeen = notificationsPayload.some((n) => n?.title === createdNotification.title);
        if (adSeen) servedAdCount += 1;
        if (notificationSeen) servedNotificationCount += 1;
      }

      expect(servedAdCount).toBe(10);
      expect(servedNotificationCount).toBe(10);

      const trackedEvents = await db
        .select({
          campaignId: enduserEvents.campaignId,
          type: enduserEvents.type,
        })
        .from(enduserEvents)
        .where(
          and(
            eq(enduserEvents.endUserId, endUserId!),
            inArray(enduserEvents.campaignId, [adCampaign.id, notificationCampaign.id])
          )
        );

      const adEventTypes = trackedEvents
        .filter((ev) => ev.campaignId === adCampaign.id)
        .map((ev) => ev.type);
      const notificationEventTypes = trackedEvents
        .filter((ev) => ev.campaignId === notificationCampaign.id)
        .map((ev) => ev.type);

      expect(adEventTypes).toHaveLength(10);
      expect(notificationEventTypes).toHaveLength(10);
      expect(adEventTypes.every((t) => t === 'ad')).toBe(true);
      expect(notificationEventTypes.every((t) => t === 'notification')).toBe(true);
      expect(
        trackedEvents.some((ev) => ev.type === 'request' || ev.type === 'redirect' || ev.type === 'visit')
      ).toBe(false);

      const softDeletedAt = new Date();
      await db
        .update(campaigns)
        .set({ status: 'deleted', updatedAt: softDeletedAt })
        .where(inArray(campaigns.id, createdCampaignIds));

      const afterSoftDelete = await db
        .select({ campaignId: enduserEvents.campaignId })
        .from(enduserEvents)
        .where(eq(enduserEvents.endUserId, endUserId!));
      expect(afterSoftDelete.length).toBe(20);
      expect(afterSoftDelete.every((r) => r.campaignId != null)).toBe(true);
    } finally {
      if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
        return;
      }
      if (endUserId) {
        await db.delete(enduserEvents).where(eq(enduserEvents.endUserId, endUserId));
      }
      if (createdCampaignIds.length > 0) {
        await db.delete(enduserEvents).where(inArray(enduserEvents.campaignId, createdCampaignIds));
        await db
          .update(campaigns)
          .set({
            adId: null,
            notificationId: null,
            redirectId: null,
            updatedAt: new Date(),
          })
          .where(inArray(campaigns.id, createdCampaignIds));
        await db.delete(campaigns).where(inArray(campaigns.id, createdCampaignIds));
      }
      if (createdAdIds.length > 0) {
        await db.delete(ads).where(inArray(ads.id, createdAdIds));
      }
      if (createdNotificationIds.length > 0) {
        await db.delete(notifications).where(inArray(notifications.id, createdNotificationIds));
      }
      if (endUserId) {
        await db.delete(endUsers).where(eq(endUsers.id, endUserId));
      }
      if (createdPlatformIds.length > 0) {
        await db.delete(platforms).where(inArray(platforms.id, createdPlatformIds));
      }
      if (createdCreatorUserId) {
        await db.delete(user).where(eq(user.id, createdCreatorUserId));
      }
    }
  });
});
