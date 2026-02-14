import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  ads,
  platforms,
  notifications,
  notificationReads,
  visitors,
  campaigns,
  campaignPlatforms,
  campaignCountries,
  campaignAd,
  campaignNotification,
  campaignVisitorViews,
  campaignLogs,
} from '@/db/schema';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';

function normalizeDomainForMatch(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  try {
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname;
  } catch {
    return trimmed;
  }
}

function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

function domainsMatch(domain1: string, domain2: string): boolean {
  const host1 = normalizeDomainForMatch(domain1);
  const host2 = normalizeDomainForMatch(domain2);
  if (host1 === host2) return true;
  const root1 = extractRootDomain(host1);
  const root2 = extractRootDomain(host2);
  return root1 === root2 && root1.length > 0;
}

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

/**
 * POST /api/extension/ad-block
 * Returns ads and/or notifications per campaign rules.
 * Body: { visitorId: string, domain: string, country?: string, requestType?: "ad" | "notification" }
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

    let body: { visitorId?: string; domain?: string; country?: string; requestType?: 'ad' | 'notification' };
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

    const { visitorId, domain, country, requestType } = body;

    if (!visitorId || !domain) {
      return NextResponse.json(
        { error: 'visitorId and domain are required' },
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

    // Resolve country: body first, then from request headers (Vercel x-vercel-ip-country, Cloudflare cf-ipcountry)
    const resolvedCountry =
      (country !== undefined && country !== null && String(country).trim() !== ''
        ? String(country).toUpperCase().slice(0, 2)
        : null) ?? getCountryFromHeaders(request);

    // Upsert visitors (optional country)
    await db
      .insert(visitors)
      .values({
        visitorId,
        country: resolvedCountry,
        createdAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: visitors.visitorId,
        set: { lastSeenAt: now, ...(resolvedCountry !== null && { country: resolvedCountry }) },
      });

    const allPlatformsList = await db
      .select({ id: platforms.id, domain: platforms.domain })
      .from(platforms)
      .where(eq(platforms.isActive, true));

    const platform = allPlatformsList.find((p) => domainsMatch(p.domain, domain));

    if (!platform) {
      return NextResponse.json({ ads: [], notifications: [] });
    }

    type AdOut = { title: string; image: string | null; description: string | null; redirectUrl: string | null; htmlCode?: string | null; displayAs?: 'inline' | 'popup' };
    type NotifOut = { title: string; message: string; ctaLink?: string | null };
    let publicAds: AdOut[] = [];
    let publicNotifications: NotifOut[] = [];

    // Resolve campaigns for this platform (include status, startDate, endDate)
    const campaignsForPlatform = await db
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
      .where(eq(campaignPlatforms.platformId, platform.id));

    const visitorRow = await db.select().from(visitors).where(eq(visitors.visitorId, visitorId)).limit(1);
    const visitorCreatedAt = visitorRow[0]?.createdAt ?? now;
    const visitorCountry = visitorRow[0]?.country?.toUpperCase().slice(0, 2) ?? null;
    const isNew = isNewUser(visitorCreatedAt);
    const currentMinutes = currentTimeInMinutes();

    // Fetch campaign country targets for all campaigns on this platform
    const campaignIds = campaignsForPlatform.map((c) => c.id);
    const countryRows =
      campaignIds.length > 0
        ? await db
          .select({ campaignId: campaignCountries.campaignId, countryCode: campaignCountries.countryCode })
          .from(campaignCountries)
          .where(inArray(campaignCountries.campaignId, campaignIds))
        : [];
    const campaignCountryMap = new Map<string, Set<string>>();
    for (const row of countryRows) {
      if (!campaignCountryMap.has(row.campaignId)) {
        campaignCountryMap.set(row.campaignId, new Set());
      }
      campaignCountryMap.get(row.campaignId)!.add(row.countryCode.toUpperCase());
    }

    const qualifyingCampaigns: typeof campaignsForPlatform = [];
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
        const [viewRow] = await db
          .select()
          .from(campaignVisitorViews)
          .where(
            and(
              eq(campaignVisitorViews.campaignId, c.id),
              eq(campaignVisitorViews.visitorId, visitorId)
            )
          )
          .limit(1);
        if (c.frequencyType === 'only_once' && viewRow && viewRow.viewCount >= 1) continue;
        if (c.frequencyType === 'specific_count' && c.frequencyCount !== null && viewRow && viewRow.viewCount >= c.frequencyCount) continue;
      }

      // Country targeting: if campaign has country targets, visitor must be in one of them
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
        const [adRow] = await db
          .select({ adId: campaignAd.adId })
          .from(campaignAd)
          .where(eq(campaignAd.campaignId, c.id))
          .limit(1);
        if (adRow) {
          adIds.set(adRow.adId, c.campaignType === 'popup' ? 'popup' : 'inline');
        }
      }
      if (c.campaignType === 'notification') {
        const [notifRow] = await db
          .select({ notificationId: campaignNotification.notificationId })
          .from(campaignNotification)
          .where(eq(campaignNotification.campaignId, c.id))
          .limit(1);
        if (notifRow) notificationIds.add(notifRow.notificationId);
      }
    }

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
    }

    if (shouldFetchNotifications && notificationIds.size > 0) {
      const notifList = await db
        .select({
          id: notifications.id,
          title: notifications.title,
          message: notifications.message,
          ctaLink: notifications.ctaLink,
        })
        .from(notifications)
        .leftJoin(
          notificationReads,
          and(
            eq(notificationReads.notificationId, notifications.id),
            eq(notificationReads.visitorId, visitorId)
          )
        )
        .where(
          and(
            inArray(notifications.id, [...notificationIds]),
            isNull(notificationReads.id)
          )
        )
        .orderBy(notifications.createdAt);

      publicNotifications = notifList.map((n) => ({
        title: n.title,
        message: n.message,
        ctaLink: n.ctaLink ?? null,
      }));

      if (notifList.length > 0) {
        try {
          await db.insert(notificationReads).values(
            notifList.map((n) => ({ notificationId: n.id, visitorId }))
          );
        } catch {
          // ignore duplicate reads
        }
      }
    }

    // Record campaign views for frequency
    for (const c of qualifyingCampaigns) {
      await db
        .insert(campaignVisitorViews)
        .values({
          campaignId: c.id,
          visitorId,
          viewCount: 1,
          lastViewedAt: now,
        })
        .onConflictDoUpdate({
          target: [campaignVisitorViews.campaignId, campaignVisitorViews.visitorId],
          set: {
            viewCount: sql`campaign_visitor_views.view_count + 1`,
            lastViewedAt: now,
          },
        });
    }

    // Log to campaign_logs (with campaign_id)
    for (const c of qualifyingCampaigns) {
      if (c.campaignType === 'ads' && shouldFetchAds) {
        const [adRow] = await db
          .select({ adId: campaignAd.adId })
          .from(campaignAd)
          .where(eq(campaignAd.campaignId, c.id))
          .limit(1);
        if (adRow) {
          await db.insert(campaignLogs).values({
            campaignId: c.id,
            visitorId,
            domain,
            type: 'ad',
          });
        }
      }
      if (c.campaignType === 'popup' && shouldFetchAds) {
        const [adRow] = await db
          .select({ adId: campaignAd.adId })
          .from(campaignAd)
          .where(eq(campaignAd.campaignId, c.id))
          .limit(1);
        if (adRow) {
          await db.insert(campaignLogs).values({
            campaignId: c.id,
            visitorId,
            domain,
            type: 'popup',
          });
        }
      }
      if (c.campaignType === 'notification' && shouldFetchNotifications) {
        const [notifRow] = await db
          .select({ notificationId: campaignNotification.notificationId })
          .from(campaignNotification)
          .where(eq(campaignNotification.campaignId, c.id))
          .limit(1);
        if (notifRow) {
          await db.insert(campaignLogs).values({
            campaignId: c.id,
            visitorId,
            domain,
            type: 'notification',
          });
        }
      }
    }

    return NextResponse.json({
      ads: publicAds,
      notifications: publicNotifications,
    });
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
