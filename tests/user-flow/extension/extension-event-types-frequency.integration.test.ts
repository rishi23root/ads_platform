/**
 * Integration tests:
 * - Ads + notification: `specific_count = 10`, alternating ad / notification requests, typed `ad` / `notification` events
 * - Popup: single popup campaign, ad requests only, typed `popup` events
 * - Redirect: single redirect campaign, visit domain matches rule, typed `redirect` events
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

/** Stable fixtures so reruns reuse the same campaigns (reactivate; never insert duplicates). */
const E2E_ADS_NOTIFICATION = {
  platformDomain: 'vitest-e2e--events.invalid',
  platformName: 'Vitest E2E platform (ads+notification)',
  adCampaignName: 'Vitest E2E — ads frequency cap',
  notificationCampaignName: 'Vitest E2E — notification frequency cap',
  adName: 'Vitest E2E Ad',
  notificationTitle: 'Vitest E2E Notification',
} as const;

const E2E_POPUP = {
  platformDomain: 'vitest-e2e--popup.invalid',
  platformName: 'Vitest E2E platform (popup)',
  campaignName: 'Vitest E2E — popup frequency cap',
  adName: 'Vitest E2E Popup Ad',
} as const;

const E2E_REDIRECT = {
  platformDomain: 'vitest-e2e--redirect.invalid',
  platformName: 'Vitest E2E platform (redirect)',
  redirectName: 'Vitest E2E Redirect Rule',
  campaignName: 'Vitest E2E — redirect frequency cap',
  destinationUrl: 'https://example.test/vitest-e2e-redirect-destination',
} as const;

integration('extension ad-block event typing + frequency cap', () => {
  it('caps campaign delivery at 10 and persists typed event rows', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = EXTENSION_SHARED_USER_EMAILS[0];

    const campaignIdsToDeactivate: string[] = [];
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

      let platformId: string;
      const [platformByDomain] = await db
        .select({ id: platforms.id })
        .from(platforms)
        .where(eq(platforms.domain, E2E_ADS_NOTIFICATION.platformDomain))
        .limit(1);
      if (platformByDomain?.id) {
        platformId = platformByDomain.id;
      } else {
        const [insertedPlatform] = await db
          .insert(platforms)
          .values({
            name: E2E_ADS_NOTIFICATION.platformName,
            domain: E2E_ADS_NOTIFICATION.platformDomain,
          })
          .returning({ id: platforms.id });
        platformId = insertedPlatform!.id;
        createdPlatformIds.push(platformId);
      }

      const platformDomain = E2E_ADS_NOTIFICATION.platformDomain;

      expect(creatorUserId).toBeTruthy();
      expect(platformId).toBeTruthy();
      expect(platformDomain).toBeTruthy();

      let createdAd: { id: string; name: string };
      let createdNotification: { id: string; title: string };

      const [existingAdCampaign] = await db
        .select()
        .from(campaigns)
        .where(
          and(eq(campaigns.name, E2E_ADS_NOTIFICATION.adCampaignName), eq(campaigns.campaignType, 'ads'))
        )
        .limit(1);

      let adCampaign: { id: string };
      if (existingAdCampaign?.id) {
        adCampaign = { id: existingAdCampaign.id };
        campaignIdsToDeactivate.push(existingAdCampaign.id);
        expect(existingAdCampaign.adId).toBeTruthy();
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [platformId],
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingAdCampaign.id));
        const [adRow] = await db
          .select({ id: ads.id, name: ads.name })
          .from(ads)
          .where(eq(ads.id, existingAdCampaign.adId!))
          .limit(1);
        expect(adRow?.id).toBeTruthy();
        createdAd = adRow!;
      } else {
        const [insertedAd] = await db
          .insert(ads)
          .values({
            name: E2E_ADS_NOTIFICATION.adName,
            description: 'Integration test ad',
            targetUrl: 'https://example.test/ad',
          })
          .returning({ id: ads.id, name: ads.name });
        expect(insertedAd?.id).toBeTruthy();
        createdAd = insertedAd;
        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_ADS_NOTIFICATION.adCampaignName,
            targetAudience: 'all_users',
            campaignType: 'ads',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            adId: insertedAd.id,
            platformIds: [platformId],
            createdBy: creatorUserId!,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        adCampaign = { id: insertedCamp.id };
        campaignIdsToDeactivate.push(insertedCamp.id);
      }

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

      let notificationCampaign: { id: string };
      if (existingNotifCampaign?.id) {
        notificationCampaign = { id: existingNotifCampaign.id };
        campaignIdsToDeactivate.push(existingNotifCampaign.id);
        expect(existingNotifCampaign.notificationId).toBeTruthy();
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [],
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingNotifCampaign.id));
        const [nRow] = await db
          .select({ id: notifications.id, title: notifications.title })
          .from(notifications)
          .where(eq(notifications.id, existingNotifCampaign.notificationId!))
          .limit(1);
        expect(nRow?.id).toBeTruthy();
        createdNotification = { id: nRow!.id, title: nRow!.title };
      } else {
        const [insertedNotif] = await db
          .insert(notifications)
          .values({
            title: E2E_ADS_NOTIFICATION.notificationTitle,
            message: 'Integration test notification',
            ctaLink: 'https://example.test/notification',
          })
          .returning({ id: notifications.id, title: notifications.title });
        expect(insertedNotif?.id).toBeTruthy();
        createdNotification = insertedNotif;
        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_ADS_NOTIFICATION.notificationCampaignName,
            targetAudience: 'all_users',
            campaignType: 'notification',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            notificationId: insertedNotif.id,
            platformIds: [],
            createdBy: creatorUserId!,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        notificationCampaign = { id: insertedCamp.id };
        campaignIdsToDeactivate.push(insertedCamp.id);
      }

      const initial = await registerOrLoginExtensionEndUser(
        BASE!,
        email,
        EXTENSION_INTEGRATION_PASSWORD
      );
      endUserId = initial.endUserId;
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
      // Handler only records ad / notification / popup / redirect — never request or visit.
      expect(
        trackedEvents.some((ev) => ev.type === 'request' || ev.type === 'visit')
      ).toBe(false);

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
            eq(enduserEvents.endUserId, endUserId!),
            inArray(enduserEvents.campaignId, campaignIdsToDeactivate)
          )
        );
      expect(afterSoftDelete.length).toBe(20);
      expect(afterSoftDelete.every((r) => r.campaignId != null)).toBe(true);
    } finally {
      if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
        return;
      }
      if (endUserId) {
        await db.delete(enduserEvents).where(eq(enduserEvents.endUserId, endUserId));
      }
      // Reuse campaigns across runs: only soft-delete; do not remove rows.
      if (campaignIdsToDeactivate.length > 0) {
        await db
          .update(campaigns)
          .set({ status: 'deleted', updatedAt: new Date() })
          .where(inArray(campaigns.id, campaignIdsToDeactivate));
      }
      if (createdPlatformIds.length > 0) {
        await db.delete(platforms).where(inArray(platforms.id, createdPlatformIds));
      }
      if (createdCreatorUserId) {
        await db.delete(user).where(eq(user.id, createdCreatorUserId));
      }
    }
  });

  it('popup campaign caps at 10 and logs popup events', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = EXTENSION_SHARED_USER_EMAILS[1];

    const campaignIdsToDeactivate: string[] = [];
    const createdPlatformIds: string[] = [];
    const testForwardedIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let createdCreatorUserId: string | null = null;
    let endUserId: string | null = null;

    try {
      const existingCreator = await db.select({ id: user.id }).from(user).limit(1);
      let creatorUserId = existingCreator[0]?.id ?? null;
      if (!creatorUserId) {
        creatorUserId = `vitest-creator-popup-${suffix}`;
        await db.insert(user).values({
          id: creatorUserId,
          email: `vitest.creator.popup.${suffix}@example.test`,
          name: 'Vitest Creator',
          emailVerified: true,
          role: 'admin',
        });
        createdCreatorUserId = creatorUserId;
      }

      let platformId: string;
      const [platformByDomain] = await db
        .select({ id: platforms.id })
        .from(platforms)
        .where(eq(platforms.domain, E2E_POPUP.platformDomain))
        .limit(1);
      if (platformByDomain?.id) {
        platformId = platformByDomain.id;
      } else {
        const [insertedPlatform] = await db
          .insert(platforms)
          .values({
            name: E2E_POPUP.platformName,
            domain: E2E_POPUP.platformDomain,
          })
          .returning({ id: platforms.id });
        platformId = insertedPlatform!.id;
        createdPlatformIds.push(platformId);
      }

      const platformDomain = E2E_POPUP.platformDomain;
      expect(creatorUserId).toBeTruthy();
      expect(platformId).toBeTruthy();
      expect(platformDomain).toBeTruthy();

      let popupAd: { id: string; name: string };
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
        expect(existingPopupCampaign.adId).toBeTruthy();
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [platformId],
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingPopupCampaign.id));
        const [adRow] = await db
          .select({ id: ads.id, name: ads.name })
          .from(ads)
          .where(eq(ads.id, existingPopupCampaign.adId!))
          .limit(1);
        expect(adRow?.id).toBeTruthy();
        popupAd = adRow!;
      } else {
        const [insertedAd] = await db
          .insert(ads)
          .values({
            name: E2E_POPUP.adName,
            description: 'Integration test popup',
            targetUrl: 'https://example.test/popup',
          })
          .returning({ id: ads.id, name: ads.name });
        expect(insertedAd?.id).toBeTruthy();
        popupAd = insertedAd;
        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_POPUP.campaignName,
            targetAudience: 'all_users',
            campaignType: 'popup',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            adId: insertedAd.id,
            platformIds: [platformId],
            createdBy: creatorUserId!,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        popupCampaign = { id: insertedCamp.id };
        campaignIdsToDeactivate.push(insertedCamp.id);
      }

      const initialPopup = await registerOrLoginExtensionEndUser(
        BASE!,
        email,
        EXTENSION_INTEGRATION_PASSWORD
      );
      endUserId = initialPopup.endUserId;
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
          (a) => a?.title === popupAd.name && a?.displayAs === 'popup'
        );
        if (popupSeen) servedPopupCount += 1;
      }

      expect(servedPopupCount).toBe(10);

      const popupEventTypes = await db
        .select({ type: enduserEvents.type })
        .from(enduserEvents)
        .where(
          and(eq(enduserEvents.endUserId, endUserId!), eq(enduserEvents.campaignId, popupCampaign.id))
        );

      expect(popupEventTypes).toHaveLength(10);
      expect(popupEventTypes.every((ev) => ev.type === 'popup')).toBe(true);
    } finally {
      if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
        return;
      }
      if (endUserId) {
        await db.delete(enduserEvents).where(eq(enduserEvents.endUserId, endUserId));
      }
      // Reuse campaigns across runs: only soft-delete; do not remove rows.
      if (campaignIdsToDeactivate.length > 0) {
        await db
          .update(campaigns)
          .set({ status: 'deleted', updatedAt: new Date() })
          .where(inArray(campaigns.id, campaignIdsToDeactivate));
      }
      if (createdPlatformIds.length > 0) {
        await db.delete(platforms).where(inArray(platforms.id, createdPlatformIds));
      }
      if (createdCreatorUserId) {
        await db.delete(user).where(eq(user.id, createdCreatorUserId));
      }
    }
  });

  it('redirect campaign caps at 10 and logs redirect events', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = EXTENSION_SHARED_USER_EMAILS[2];
    /** Unique per run so stray active redirects (uncapped types) cannot match this URL and inflate `servedRedirectCount`. */
    const destinationUrl = `${E2E_REDIRECT.destinationUrl}?e2e=${encodeURIComponent(suffix)}`;

    const campaignIdsToDeactivate: string[] = [];
    const createdPlatformIds: string[] = [];
    const testForwardedIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let createdCreatorUserId: string | null = null;
    let endUserId: string | null = null;

    try {
      const existingCreator = await db.select({ id: user.id }).from(user).limit(1);
      let creatorUserId = existingCreator[0]?.id ?? null;
      if (!creatorUserId) {
        creatorUserId = `vitest-creator-redir-${suffix}`;
        await db.insert(user).values({
          id: creatorUserId,
          email: `vitest.creator.redir.${suffix}@example.test`,
          name: 'Vitest Creator',
          emailVerified: true,
          role: 'admin',
        });
        createdCreatorUserId = creatorUserId;
      }

      let platformId: string;
      const platformDomain = E2E_REDIRECT.platformDomain;
      const [platformByDomain] = await db
        .select({ id: platforms.id })
        .from(platforms)
        .where(eq(platforms.domain, platformDomain))
        .limit(1);
      if (platformByDomain?.id) {
        platformId = platformByDomain.id;
      } else {
        const [insertedPlatform] = await db
          .insert(platforms)
          .values({
            name: E2E_REDIRECT.platformName,
            domain: platformDomain,
          })
          .returning({ id: platforms.id });
        platformId = insertedPlatform!.id;
        createdPlatformIds.push(platformId);
      }

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
        expect(existingRedirectCampaign.redirectId).toBeTruthy();
        await db
          .update(redirects)
          .set({
            destinationUrl,
            sourceDomain: platformDomain,
            includeSubdomains: false,
            updatedAt: new Date(),
          })
          .where(eq(redirects.id, existingRedirectCampaign.redirectId!));
        await db
          .update(campaigns)
          .set({
            status: 'active',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            platformIds: [platformId],
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, existingRedirectCampaign.id));
      } else {
        const [redir] = await db
          .insert(redirects)
          .values({
            name: E2E_REDIRECT.redirectName,
            sourceDomain: platformDomain,
            includeSubdomains: false,
            destinationUrl,
          })
          .returning({ id: redirects.id });
        expect(redir?.id).toBeTruthy();

        const [insertedCamp] = await db
          .insert(campaigns)
          .values({
            name: E2E_REDIRECT.campaignName,
            targetAudience: 'all_users',
            campaignType: 'redirect',
            frequencyType: 'specific_count',
            frequencyCount: 10,
            status: 'active',
            redirectId: redir.id,
            platformIds: [platformId],
            createdBy: creatorUserId!,
          })
          .returning({ id: campaigns.id });
        expect(insertedCamp?.id).toBeTruthy();
        redirectCampaign = { id: insertedCamp.id };
        campaignIdsToDeactivate.push(insertedCamp.id);
      }

      const initialRedir = await registerOrLoginExtensionEndUser(
        BASE!,
        email,
        EXTENSION_INTEGRATION_PASSWORD
      );
      endUserId = initialRedir.endUserId;
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
          and(eq(enduserEvents.endUserId, endUserId!), eq(enduserEvents.campaignId, redirectCampaign.id))
        );

      expect(redirectEventTypes).toHaveLength(10);
      expect(redirectEventTypes.every((ev) => ev.type === 'redirect')).toBe(true);
    } finally {
      if (process.env.EXTENSION_TEST_RETAIN_EVENTS === '1') {
        return;
      }
      if (endUserId) {
        await db.delete(enduserEvents).where(eq(enduserEvents.endUserId, endUserId));
      }
      if (campaignIdsToDeactivate.length > 0) {
        await db
          .update(campaigns)
          .set({ status: 'deleted', updatedAt: new Date() })
          .where(inArray(campaigns.id, campaignIdsToDeactivate));
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
