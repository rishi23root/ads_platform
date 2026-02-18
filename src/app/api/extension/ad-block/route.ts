import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  ads,
  platforms,
  notifications,
  visitors,
  campaigns,
  campaignPlatforms,
  campaignCountries,
  campaignAd,
  campaignNotification,
} from '@/db/schema';
import { eq, and, inArray, sql, notInArray } from 'drizzle-orm';
import { domainsMatch } from '@/lib/domain-utils';

function isNewUser(createdAt: Date, withinDays = 7): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  return new Date(createdAt) >= cutoff;
}

function currentTimeInMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.length >= 2) return parts[0] * 60 + parts[1];
  return null;
}

function isCampaignActive(
  status: string,
  startDate: Date | null,
  endDate: Date | null,
  now: Date
): boolean {
  if (status !== 'active') return false;
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
}

/** Get 2-letter country code from request headers (Vercel, Cloudflare, etc.) */
function getCountryFromHeaders(request: NextRequest): string | null {
  const vercel = request.headers.get('x-vercel-ip-country');
  if (vercel && /^[A-Z]{2}$/i.test(vercel)) return vercel.toUpperCase();
  const cf = request.headers.get('cf-ipcountry');
  if (cf && cf !== 'XX' && /^[A-Z]{2}$/i.test(cf)) return cf.toUpperCase();
  return null;
}

type CampaignRow = {
  id: string;
  targetAudience: string;
  campaignType: string;
  frequencyType: string;
  frequencyCount: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
};

/**
 * POST /api/extension/ad-block
 * Returns ads and/or notifications per campaign rules.
 * Body: { visitorId: string, domain?: string, requestType?: "ad" | "notification" }
 * - domain is required when requesting ads; optional when requestType is "notification" only.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    let body: { visitorId?: string; domain?: string; requestType?: 'ad' | 'notification' };
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        },
        { status: 400 }
      );
    }

    const { visitorId, domain, requestType } = body;

    const country = getCountryFromHeaders(request);
    // console.log('[ad-block] req', { visitorId, domain: domain ?? null, country, requestType: requestType ?? null });

    if (!visitorId) {
      return NextResponse.json(
        { error: 'visitorId is required' },
        { status: 400 }
      );
    }

    // Domain is required for ads only; optional for notifications (served everywhere when not specified)
    const isNotificationOnly = requestType === 'notification';
    if (!domain && !isNotificationOnly) {
      return NextResponse.json(
        { error: 'domain is required when requesting ads' },
        { status: 400 }
      );
    }

    if (requestType !== undefined && requestType !== 'ad' && requestType !== 'notification') {
      return NextResponse.json(
        { error: 'requestType must be either "ad" or "notification"' },
        { status: 400 }
      );
    }

    const shouldFetchAds = requestType === undefined || requestType === 'ad';
    const shouldFetchNotifications = requestType === undefined || requestType === 'notification';

    const now = new Date();

    const allPlatformsList = await db
      .select({ id: platforms.id, domain: platforms.domain })
      .from(platforms)
      .where(eq(platforms.isActive, true));

    const platform = domain ? allPlatformsList.find((p) => domainsMatch(p.domain, domain)) : null;

    // No early return: when platform is null we still serve global notification campaigns (no domain restriction)

    type AdOut = { title: string; image: string | null; description: string | null; redirectUrl: string | null; htmlCode?: string | null; displayAs?: 'inline' | 'popup' };
    type NotifOut = { title: string; message: string; ctaLink?: string | null };
    let publicAds: AdOut[] = [];
    let publicNotifications: NotifOut[] = [];

    // Resolve campaigns:
    // - When platform exists: campaigns linked to that platform (ads + notifications)
    // - Always: notification campaigns with NO platforms (empty domain list = no domain restriction)
    const [platformCampaigns, globalNotifCampaigns] = await Promise.all([
      platform
        ? db
          .select({
            id: campaigns.id,
            targetAudience: campaigns.targetAudience,
            campaignType: campaigns.campaignType,
            frequencyType: campaigns.frequencyType,
            frequencyCount: campaigns.frequencyCount,
            timeStart: campaigns.timeStart,
            timeEnd: campaigns.timeEnd,
            status: campaigns.status,
            startDate: campaigns.startDate,
            endDate: campaigns.endDate,
          })
          .from(campaigns)
          .innerJoin(campaignPlatforms, eq(campaignPlatforms.campaignId, campaigns.id))
          .where(eq(campaignPlatforms.platformId, platform.id))
        : [],
      (async () => {
        const campaignIdsWithPlatforms = await db
          .selectDistinct({ campaignId: campaignPlatforms.campaignId })
          .from(campaignPlatforms);
        const ids = campaignIdsWithPlatforms.map((r) => r.campaignId);
        return ids.length > 0
          ? db
            .select({
              id: campaigns.id,
              targetAudience: campaigns.targetAudience,
              campaignType: campaigns.campaignType,
              frequencyType: campaigns.frequencyType,
              frequencyCount: campaigns.frequencyCount,
              timeStart: campaigns.timeStart,
              timeEnd: campaigns.timeEnd,
              status: campaigns.status,
              startDate: campaigns.startDate,
              endDate: campaigns.endDate,
            })
            .from(campaigns)
            .where(and(eq(campaigns.campaignType, 'notification'), notInArray(campaigns.id, ids)))
          : db
            .select({
              id: campaigns.id,
              targetAudience: campaigns.targetAudience,
              campaignType: campaigns.campaignType,
              frequencyType: campaigns.frequencyType,
              frequencyCount: campaigns.frequencyCount,
              timeStart: campaigns.timeStart,
              timeEnd: campaigns.timeEnd,
              status: campaigns.status,
              startDate: campaigns.startDate,
              endDate: campaigns.endDate,
            })
            .from(campaigns)
            .where(eq(campaigns.campaignType, 'notification'));
      })(),
    ]);

    const platformRows = platformCampaigns;
    const globalRows = globalNotifCampaigns;
    const seenIds = new Set<string>();
    const campaignsForPlatform: CampaignRow[] = [];
    for (const c of platformRows) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        campaignsForPlatform.push(c);
      }
    }
    for (const c of globalRows) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        campaignsForPlatform.push(c);
      }
    }
    const campaignIds = campaignsForPlatform.map((c) => c.id);

    const [visitorFirstSeen, countryRows, viewCountRows, campaignAdRows, campaignNotifRows] = await Promise.all([
      db
        .select({ createdAt: sql<Date>`MIN(${visitors.createdAt})`.as('created_at') })
        .from(visitors)
        .where(eq(visitors.visitorId, visitorId)),
      campaignIds.length > 0
        ? db
          .select({ campaignId: campaignCountries.campaignId, countryCode: campaignCountries.countryCode })
          .from(campaignCountries)
          .where(inArray(campaignCountries.campaignId, campaignIds))
        : [],
      campaignIds.length > 0
        ? db
          .select({
            campaignId: visitors.campaignId,
            viewCount: sql<number>`COUNT(*)`.as('view_count'),
          })
          .from(visitors)
          .where(
            and(
              eq(visitors.visitorId, visitorId),
              inArray(visitors.campaignId, campaignIds)
            )
          )
          .groupBy(visitors.campaignId)
        : [],
      campaignIds.length > 0
        ? db
          .select({ campaignId: campaignAd.campaignId, adId: campaignAd.adId })
          .from(campaignAd)
          .where(inArray(campaignAd.campaignId, campaignIds))
        : [],
      campaignIds.length > 0
        ? db
          .select({ campaignId: campaignNotification.campaignId, notificationId: campaignNotification.notificationId })
          .from(campaignNotification)
          .where(inArray(campaignNotification.campaignId, campaignIds))
        : [],
    ]);

    const visitorCreatedAt = visitorFirstSeen[0]?.createdAt ?? now;
    const visitorCountry = country;
    const isNew = isNewUser(visitorCreatedAt);
    const currentMinutes = currentTimeInMinutes();

    const campaignCountryMap = new Map<string, Set<string>>();
    for (const row of countryRows) {
      if (!campaignCountryMap.has(row.campaignId)) {
        campaignCountryMap.set(row.campaignId, new Set());
      }
      campaignCountryMap.get(row.campaignId)!.add(row.countryCode.toUpperCase());
    }

    const viewCountMap = new Map<string, number>();
    for (const row of viewCountRows) {
      if (row.campaignId) viewCountMap.set(row.campaignId, Number(row.viewCount));
    }

    const campaignAdMap = new Map<string, string>();
    for (const row of campaignAdRows) {
      campaignAdMap.set(row.campaignId, row.adId);
    }

    const campaignNotifMap = new Map<string, string>();
    for (const row of campaignNotifRows) {
      campaignNotifMap.set(row.campaignId, row.notificationId);
    }

    const qualifyingCampaigns: CampaignRow[] = [];
    for (const c of campaignsForPlatform) {
      if (!isCampaignActive(c.status, c.startDate, c.endDate, now)) continue;
      if (c.targetAudience === 'new_users' && !isNew) continue;

      if (c.frequencyType === 'time_based') {
        const start = parseTimeToMinutes(c.timeStart);
        const end = parseTimeToMinutes(c.timeEnd);
        if (start !== null && end !== null) {
          if (start <= end) {
            if (currentMinutes < start || currentMinutes > end) continue;
          } else {
            if (currentMinutes > end && currentMinutes < start) continue;
          }
        }
      }

      if (c.frequencyType === 'only_once' || c.frequencyType === 'specific_count') {
        const viewCount = viewCountMap.get(c.id) ?? 0;
        if (c.frequencyType === 'only_once' && viewCount >= 1) continue;
        if (c.frequencyType === 'specific_count' && c.frequencyCount !== null && viewCount >= c.frequencyCount) continue;
      }

      const campaignCountriesSet = campaignCountryMap.get(c.id);
      if (campaignCountriesSet && campaignCountriesSet.size > 0) {
        if (!visitorCountry) continue;
        if (!campaignCountriesSet.has(visitorCountry)) continue;
      }

      qualifyingCampaigns.push(c);
    }

    const adIds = new Map<string, 'inline' | 'popup'>();
    const notificationIds = new Set<string>();

    for (const c of qualifyingCampaigns) {
      if (c.campaignType === 'ads' || c.campaignType === 'popup') {
        const adId = campaignAdMap.get(c.id);
        if (adId) {
          adIds.set(adId, c.campaignType === 'popup' ? 'popup' : 'inline');
        }
      }
      if (c.campaignType === 'notification') {
        const notifId = campaignNotifMap.get(c.id);
        if (notifId) notificationIds.add(notifId);
      }
    }

    const servedAdIds = new Set<string>();
    if (shouldFetchAds && adIds.size > 0) {
      const adList = await db
        .select({
          id: ads.id,
          name: ads.name,
          description: ads.description,
          imageUrl: ads.imageUrl,
          targetUrl: ads.targetUrl,
          htmlCode: ads.htmlCode,
        })
        .from(ads)
        .where(inArray(ads.id, [...adIds.keys()]))
        .orderBy(ads.createdAt);

      publicAds = adList.map((ad) => ({
        title: ad.name,
        image: ad.imageUrl,
        description: ad.description ?? null,
        redirectUrl: ad.targetUrl ?? null,
        htmlCode: ad.htmlCode ?? null,
        displayAs: adIds.get(ad.id) ?? 'inline',
      }));
      for (const a of adList) servedAdIds.add(a.id);
    }

    const servedNotificationIds = new Set<string>();
    if (shouldFetchNotifications && notificationIds.size > 0) {
      // Notifications come from qualifying campaigns only. Campaign filters (frequency, country, time, etc.)
      // and viewCount from visitors determine if we should serve.
      const notifList = await db
        .select({
          id: notifications.id,
          title: notifications.title,
          message: notifications.message,
          ctaLink: notifications.ctaLink,
        })
        .from(notifications)
        .where(inArray(notifications.id, [...notificationIds]))
        .orderBy(notifications.createdAt);

      publicNotifications = notifList.map((n) => ({
        title: n.title,
        message: n.message,
        ctaLink: n.ctaLink ?? null,
      }));

      for (const n of notifList) servedNotificationIds.add(n.id);
    }

    // Insert visitor events: one row per campaign served, or one 'request' row when nothing served
    const logDomain = domain ?? 'extension';
    const visitorEvents: { visitorId: string; campaignId: string; domain: string; country: string | null; type: 'ad' | 'notification' | 'popup'; statusCode: number }[] = [];
    for (const c of qualifyingCampaigns) {
      const adId = campaignAdMap.get(c.id);
      const notifId = campaignNotifMap.get(c.id);
      if (c.campaignType === 'ads' && shouldFetchAds && adId && servedAdIds.has(adId)) {
        visitorEvents.push({ visitorId, campaignId: c.id, domain: logDomain, country: country, type: 'ad', statusCode: 200 });
      }
      if (c.campaignType === 'popup' && shouldFetchAds && adId && servedAdIds.has(adId)) {
        visitorEvents.push({ visitorId, campaignId: c.id, domain: logDomain, country: country, type: 'popup', statusCode: 200 });
      }
      if (c.campaignType === 'notification' && shouldFetchNotifications && notifId && servedNotificationIds.has(notifId)) {
        visitorEvents.push({ visitorId, campaignId: c.id, domain: logDomain, country: country, type: 'notification', statusCode: 200 });
      }
    }
    if (visitorEvents.length > 0) {
      await db.insert(visitors).values(visitorEvents);
    } else {
      // Log every request, even when nothing served
      await db.insert(visitors).values({
        visitorId,
        campaignId: null,
        domain: logDomain,
        country: country,
        type: 'request',
        statusCode: 200,
      });
    }

    const res = { ads: publicAds, notifications: publicNotifications };
    console.log('[ad-block] res', { domain: domain ?? 'extension', ads: publicAds.length, notifications: publicNotifications.length });
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error fetching extension ad block:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      { error: 'Failed to fetch ad block', ...(isDev && { details: message }) },
      { status: 500 }
    );
  }
}
