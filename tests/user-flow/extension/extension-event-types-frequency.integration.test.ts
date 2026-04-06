/**
 * Integration tests:
 * - Ads + notification: `specific_count = 10`, alternating ad / notification requests, typed `ad` / `notification` events
 * - Popup: single popup campaign, ad requests only, typed `popup` events
 * - Redirect: single redirect campaign, visit domain matches rule, typed `redirect` events
 *
 * **One** shared ad, notification, and redirect row (get-or-create) back every campaign; campaigns stay
 * distinct but reuse content ids. Platforms persist (not deleted in teardown). Creator user is stable when absent.
 *
 * Opt-in via EXTENSION_INTEGRATION=1 and a running app base URL.
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

const E2E_CREATOR_KEY = 'e2e-events';

/** Single canonical content rows for all E2E campaigns in this file. */
const E2E_SHARED = {
  ad: {
    name: 'Vitest E2E Shared Ad',
    description: 'Integration test ad / popup creative',
    targetUrl: 'https://example.test/e2e-shared-ad',
  },
  notification: {
    title: 'Vitest E2E Shared Notification',
    message: 'Integration test notification',
    ctaLink: 'https://example.test/e2e-shared-notification',
  },
  redirect: {
    name: 'Vitest E2E Shared Redirect Rule',
    sourceDomain: 'vitest-e2e--redirect.invalid',
    destinationUrl: 'https://example.test/vitest-e2e-redirect-destination',
  },
} as const;

/** Stable fixtures: campaigns by name (reactivate after soft-delete). */
const E2E_ADS_NOTIFICATION = {
  platformDomain: 'vitest-e2e--events.invalid',
  platformName: 'Vitest E2E platform (ads+notification)',
  adCampaignName: 'Vitest E2E — ads frequency cap',
  notificationCampaignName: 'Vitest E2E — notification frequency cap',
} as const;

const E2E_POPUP = {
  platformDomain: 'vitest-e2e--popup.invalid',
  platformName: 'Vitest E2E platform (popup)',
  campaignName: 'Vitest E2E — popup frequency cap',
} as const;

const E2E_REDIRECT = {
  platformDomain: E2E_SHARED.redirect.sourceDomain,
  platformName: 'Vitest E2E platform (redirect)',
  campaignName: 'Vitest E2E — redirect frequency cap',
} as const;

async function ensureE2eCreatorUser(): Promise<{
  creatorUserId: string;
  createdCreatorUserId: string | null;
}> {
  const existingCreator = await db.select({ id: user.id }).from(user).limit(1);
  let creatorUserId = existingCreator[0]?.id ?? null;
  let createdCreatorUserId: string | null = null;
  if (!creatorUserId) {
    creatorUserId = `vitest-creator-${E2E_CREATOR_KEY}`;
    await db.insert(user).values({
      id: creatorUserId,
      email: `vitest.creator.${E2E_CREATOR_KEY}@example.test`,
      name: 'Vitest Creator',
      emailVerified: true,
      role: 'admin',
    });
    createdCreatorUserId = creatorUserId;
  }
  return { creatorUserId: creatorUserId!, createdCreatorUserId };
}

async function getOrCreatePlatform(domain: string, name: string): Promise<string> {
  const [byDomain] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.domain, domain))
    .limit(1);
  if (byDomain?.id) return byDomain.id;
  const [inserted] = await db.insert(platforms).values({ name, domain }).returning({ id: platforms.id });
  return inserted!.id;
}

async function getOrCreateSharedAd(): Promise<{ id: string; name: string }> {
  const [byName] = await db.select({ id: ads.id, name: ads.name }).from(ads).where(eq(ads.name, E2E_SHARED.ad.name)).limit(1);
  if (byName?.id) {
    await db
      .update(ads)
      .set({
        description: E2E_SHARED.ad.description,
        targetUrl: E2E_SHARED.ad.targetUrl,
        updatedAt: new Date(),
      })
      .where(eq(ads.id, byName.id));
    return { id: byName.id, name: byName.name };
  }
  const [row] = await db
    .insert(ads)
    .values({
      name: E2E_SHARED.ad.name,
      description: E2E_SHARED.ad.description,
      targetUrl: E2E_SHARED.ad.targetUrl,
    })
    .returning({ id: ads.id, name: ads.name });
  return row!;
}

async function getOrCreateSharedNotification(): Promise<{ id: string; title: string }> {
  const [byTitle] = await db
    .select({ id: notifications.id, title: notifications.title })
    .from(notifications)
    .where(eq(notifications.title, E2E_SHARED.notification.title))
    .limit(1);
  if (byTitle?.id) {
    await db
      .update(notifications)
      .set({
        message: E2E_SHARED.notification.message,
        ctaLink: E2E_SHARED.notification.ctaLink,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, byTitle.id));
    return { id: byTitle.id, title: byTitle.title };
  }
  const [row] = await db
    .insert(notifications)
    .values({
      title: E2E_SHARED.notification.title,
      message: E2E_SHARED.notification.message,
      ctaLink: E2E_SHARED.notification.ctaLink,
    })
    .returning({ id: notifications.id, title: notifications.title });
  return row!;
}

async function getOrCreateSharedRedirect(): Promise<{ id: string; destinationUrl: string }> {
  const [byName] = await db
    .select({ id: redirects.id })
    .from(redirects)
    .where(eq(redirects.name, E2E_SHARED.redirect.name))
    .limit(1);
  if (byName?.id) {
    await db
      .update(redirects)
      .set({
        sourceDomain: E2E_SHARED.redirect.sourceDomain,
        includeSubdomains: false,
        destinationUrl: E2E_SHARED.redirect.destinationUrl,
        updatedAt: new Date(),
      })
      .where(eq(redirects.id, byName.id));
    return { id: byName.id, destinationUrl: E2E_SHARED.redirect.destinationUrl };
  }
  const [row] = await db
    .insert(redirects)
    .values({
      name: E2E_SHARED.redirect.name,
      sourceDomain: E2E_SHARED.redirect.sourceDomain,
      includeSubdomains: false,
      destinationUrl: E2E_SHARED.redirect.destinationUrl,
    })
    .returning({ id: redirects.id, destinationUrl: redirects.destinationUrl });
  return { id: row!.id, destinationUrl: row!.destinationUrl };
}

integration('extension ad-block event typing + frequency cap', () => {
  it('caps campaign delivery at 10 and persists typed event rows', async () => {
    const email = EXTENSION_SHARED_USER_EMAILS[0];

    const campaignIdsToDeactivate: string[] = [];
    const testForwardedIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let createdCreatorUserId: string | null = null;
    let userIdentifier: string | null = null;

    try {
      const { creatorUserId, createdCreatorUserId: newCreator } = await ensureE2eCreatorUser();
      createdCreatorUserId = newCreator;

      const sharedAd = await getOrCreateSharedAd();
      const sharedNotification = await getOrCreateSharedNotification();
      const platformId = await getOrCreatePlatform(
        E2E_ADS_NOTIFICATION.platformDomain,
        E2E_ADS_NOTIFICATION.platformName
      );
      const platformDomain = E2E_ADS_NOTIFICATION.platformDomain;

      expect(creatorUserId).toBeTruthy();
      expect(platformId).toBeTruthy();
      expect(platformDomain).toBeTruthy();

      let adCampaign: { id: string };
      const [existingAdCampaign] = await db
        .select()
        .from(campaigns)
        .where(
          and(eq(campaigns.name, E2E_ADS_NOTIFICATION.adCampaignName), eq(campaigns.campaignType, 'ads'))
        )
        .limit(1);

      if (existingAdCampaign?.id) {
        adCampaign = { id: existingAdCampaign.id };
        campaignIdsToDeactivate.push(existingAdCampaign.id);
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [platformId],
            adId: sharedAd.id,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingAdCampaign.id));
      } else {
        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_ADS_NOTIFICATION.adCampaignName,
            targetAudience: 'all_users',
            campaignType: 'ads',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            adId: sharedAd.id,
            platformIds: [platformId],
            createdBy: creatorUserId,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        adCampaign = { id: insertedCamp!.id };
        campaignIdsToDeactivate.push(insertedCamp!.id);
      }

      let notificationCampaign: { id: string };
      const [existingNotifCampaign] = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.name, E2E_ADS_NOTIFICATION.notificationCampaignName),
            eq(campaigns.campaignType, 'notification')
          )
        )
        .limit(1);

      if (existingNotifCampaign?.id) {
        notificationCampaign = { id: existingNotifCampaign.id };
        campaignIdsToDeactivate.push(existingNotifCampaign.id);
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [],
            notificationId: sharedNotification.id,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingNotifCampaign.id));
      } else {
        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_ADS_NOTIFICATION.notificationCampaignName,
            targetAudience: 'all_users',
            campaignType: 'notification',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            notificationId: sharedNotification.id,
            platformIds: [],
            createdBy: creatorUserId,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        notificationCampaign = { id: insertedCamp!.id };
        campaignIdsToDeactivate.push(insertedCamp!.id);
      }

      const initial = await registerOrLoginExtensionEndUser(
        BASE!,
        email,
        EXTENSION_INTEGRATION_PASSWORD
      );
      userIdentifier = initial.userIdentifier;
      const session = { token: initial.token };

      let servedAdCount = 0;
      let servedNotificationCount = 0;
      for (let i = 0; i < 100; i++) {
        const isAdRequest = i % 2 === 0;
        const payload = isAdRequest
          ? { domain: platformDomain, requestType: 'ad' as const }
          : { requestType: 'notification' as const };

        const blockRes = await postExtensionAdBlock(
          BASE!,
          email,
          EXTENSION_INTEGRATION_PASSWORD,
          session,
          payload,
          {
            'user-agent': 'vitest-extension-events-frequency',
            'x-forwarded-for': testForwardedIp,
          }
        );
        expect(blockRes.status).toBe(200);
        const blockJson = (await blockRes.json()) as {
          ads?: Array<{ title?: string }>;
          notifications?: Array<{ title?: string }>;
        };
        const adsPayload = blockJson.ads ?? [];
        const notificationsPayload = blockJson.notifications ?? [];
        const adSeen = adsPayload.some((a) => a?.title === sharedAd.name);
        const notificationSeen = notificationsPayload.some(
          (n) => n?.title === sharedNotification.title
        );
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
            eq(enduserEvents.userIdentifier, userIdentifier!),
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
      expect(trackedEvents.some((ev) => ev.type === 'visit')).toBe(false);

      const softDeletedAt = new Date();
      await db
        .update(campaigns)
        .set({ status: 'deleted', updatedAt: softDeletedAt })
        .where(inArray(campaigns.id, campaignIdsToDeactivate));

      const afterSoftDelete = await db
        .select({ campaignId: enduserEvents.campaignId })
        .from(enduserEvents)
        .where(
          and(
            eq(enduserEvents.userIdentifier, userIdentifier!),
            inArray(enduserEvents.campaignId, campaignIdsToDeactivate)
          )
        );
      expect(afterSoftDelete.length).toBe(20);
      expect(afterSoftDelete.every((r) => r.campaignId != null)).toBe(true);
    } finally {
      if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
        return;
      }
      if (userIdentifier) {
        await db.delete(enduserEvents).where(eq(enduserEvents.userIdentifier, userIdentifier));
      }
      if (campaignIdsToDeactivate.length > 0) {
        await db
          .update(campaigns)
          .set({ status: 'deleted', updatedAt: new Date() })
          .where(inArray(campaigns.id, campaignIdsToDeactivate));
      }
      if (createdCreatorUserId) {
        await db.delete(user).where(eq(user.id, createdCreatorUserId));
      }
    }
  });

  it('popup campaign caps at 10 and logs popup events', async () => {
    const email = EXTENSION_SHARED_USER_EMAILS[1];

    const campaignIdsToDeactivate: string[] = [];
    const testForwardedIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let createdCreatorUserId: string | null = null;
    let userIdentifier: string | null = null;

    try {
      const { creatorUserId, createdCreatorUserId: newCreator } = await ensureE2eCreatorUser();
      createdCreatorUserId = newCreator;

      const sharedAd = await getOrCreateSharedAd();
      const platformId = await getOrCreatePlatform(E2E_POPUP.platformDomain, E2E_POPUP.platformName);
      const platformDomain = E2E_POPUP.platformDomain;
      expect(creatorUserId).toBeTruthy();
      expect(platformId).toBeTruthy();
      expect(platformDomain).toBeTruthy();

      let popupCampaign: { id: string };

      const [existingPopupCampaign] = await db
        .select()
        .from(campaigns)
        .where(
          and(eq(campaigns.name, E2E_POPUP.campaignName), eq(campaigns.campaignType, 'popup'))
        )
        .limit(1);

      if (existingPopupCampaign?.id) {
        popupCampaign = { id: existingPopupCampaign.id };
        campaignIdsToDeactivate.push(existingPopupCampaign.id);
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [platformId],
            adId: sharedAd.id,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingPopupCampaign.id));
      } else {
        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_POPUP.campaignName,
            targetAudience: 'all_users',
            campaignType: 'popup',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            adId: sharedAd.id,
            platformIds: [platformId],
            createdBy: creatorUserId,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        popupCampaign = { id: insertedCamp!.id };
        campaignIdsToDeactivate.push(insertedCamp!.id);
      }

      const initialPopup = await registerOrLoginExtensionEndUser(
        BASE!,
        email,
        EXTENSION_INTEGRATION_PASSWORD
      );
      userIdentifier = initialPopup.userIdentifier;
      const sessionPopup = { token: initialPopup.token };

      let servedPopupCount = 0;
      for (let i = 0; i < 20; i++) {
        const blockRes = await postExtensionAdBlock(
          BASE!,
          email,
          EXTENSION_INTEGRATION_PASSWORD,
          sessionPopup,
          { domain: platformDomain, requestType: 'ad' as const },
          {
            'user-agent': 'vitest-extension-popup-frequency',
            'x-forwarded-for': testForwardedIp,
          }
        );
        expect(blockRes.status).toBe(200);
        const blockJson = (await blockRes.json()) as {
          ads?: Array<{ title?: string; displayAs?: string }>;
        };
        const adsPayload = blockJson.ads ?? [];
        const popupSeen = adsPayload.some(
          (a) => a?.title === sharedAd.name && a?.displayAs === 'popup'
        );
        if (popupSeen) servedPopupCount += 1;
      }

      expect(servedPopupCount).toBe(10);

      const popupEventTypes = await db
        .select({ type: enduserEvents.type })
        .from(enduserEvents)
        .where(
          and(
            eq(enduserEvents.userIdentifier, userIdentifier!),
            eq(enduserEvents.campaignId, popupCampaign.id)
          )
        );

      expect(popupEventTypes).toHaveLength(10);
      expect(popupEventTypes.every((ev) => ev.type === 'popup')).toBe(true);
    } finally {
      if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
        return;
      }
      if (userIdentifier) {
        await db.delete(enduserEvents).where(eq(enduserEvents.userIdentifier, userIdentifier));
      }
      if (campaignIdsToDeactivate.length > 0) {
        await db
          .update(campaigns)
          .set({ status: 'deleted', updatedAt: new Date() })
          .where(inArray(campaigns.id, campaignIdsToDeactivate));
      }
      if (createdCreatorUserId) {
        await db.delete(user).where(eq(user.id, createdCreatorUserId));
      }
    }
  });

  it('redirect campaign caps at 10 and logs redirect events', async () => {
    const email = EXTENSION_SHARED_USER_EMAILS[2];
    const destinationUrl = E2E_SHARED.redirect.destinationUrl;

    const campaignIdsToDeactivate: string[] = [];
    const testForwardedIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let createdCreatorUserId: string | null = null;
    let userIdentifier: string | null = null;

    try {
      const { creatorUserId, createdCreatorUserId: newCreator } = await ensureE2eCreatorUser();
      createdCreatorUserId = newCreator;

      const sharedRedirect = await getOrCreateSharedRedirect();
      expect(sharedRedirect.destinationUrl).toBe(destinationUrl);

      const platformDomain = E2E_REDIRECT.platformDomain;
      const platformId = await getOrCreatePlatform(E2E_REDIRECT.platformDomain, E2E_REDIRECT.platformName);

      expect(creatorUserId).toBeTruthy();
      expect(platformId).toBeTruthy();

      let redirectCampaign: { id: string };

      const [existingRedirectCampaign] = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.name, E2E_REDIRECT.campaignName),
            eq(campaigns.campaignType, 'redirect')
          )
        )
        .limit(1);

      if (existingRedirectCampaign?.id) {
        redirectCampaign = { id: existingRedirectCampaign.id };
        campaignIdsToDeactivate.push(existingRedirectCampaign.id);
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [platformId],
            redirectId: sharedRedirect.id,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingRedirectCampaign.id));
      } else {
        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_REDIRECT.campaignName,
            targetAudience: 'all_users',
            campaignType: 'redirect',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            redirectId: sharedRedirect.id,
            platformIds: [platformId],
            createdBy: creatorUserId,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        redirectCampaign = { id: insertedCamp!.id };
        campaignIdsToDeactivate.push(insertedCamp!.id);
      }

      const initialRedir = await registerOrLoginExtensionEndUser(
        BASE!,
        email,
        EXTENSION_INTEGRATION_PASSWORD
      );
      userIdentifier = initialRedir.userIdentifier;
      const sessionRedir = { token: initialRedir.token };

      let servedRedirectCount = 0;
      for (let i = 0; i < 20; i++) {
        const blockRes = await postExtensionAdBlock(
          BASE!,
          email,
          EXTENSION_INTEGRATION_PASSWORD,
          sessionRedir,
          { domain: platformDomain, requestType: 'ad' as const },
          {
            'user-agent': 'vitest-extension-redirect-frequency',
            'x-forwarded-for': testForwardedIp,
          }
        );
        expect(blockRes.status).toBe(200);
        const blockJson = (await blockRes.json()) as {
          redirects?: Array<{ destinationUrl?: string }>;
        };
        const redirectsPayload = blockJson.redirects ?? [];
        if (redirectsPayload.some((r) => r.destinationUrl === destinationUrl)) {
          servedRedirectCount += 1;
        }
      }

      expect(servedRedirectCount).toBe(10);

      const redirectEventTypes = await db
        .select({ type: enduserEvents.type })
        .from(enduserEvents)
        .where(
          and(
            eq(enduserEvents.userIdentifier, userIdentifier!),
            eq(enduserEvents.campaignId, redirectCampaign.id)
          )
        );

      expect(redirectEventTypes).toHaveLength(10);
      expect(redirectEventTypes.every((ev) => ev.type === 'redirect')).toBe(true);
    } finally {
      if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
        return;
      }
      if (userIdentifier) {
        await db.delete(enduserEvents).where(eq(enduserEvents.userIdentifier, userIdentifier));
      }
      if (campaignIdsToDeactivate.length > 0) {
        await db
          .update(campaigns)
          .set({ status: 'deleted', updatedAt: new Date() })
          .where(inArray(campaigns.id, campaignIdsToDeactivate));
      }
      if (createdCreatorUserId) {
        await db.delete(user).where(eq(user.id, createdCreatorUserId));
      }
    }
  });
});
