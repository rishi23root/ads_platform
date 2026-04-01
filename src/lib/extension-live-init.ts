import 'server-only';

import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { database as db } from '@/db';
import {
  ads,
  campaigns,
  enduserEvents,
  notifications,
  platforms,
  redirects,
} from '@/db/schema';
import type { EndUserRow } from '@/db/schema';
import { endUserPublicPayload } from '@/lib/enduser-auth';
import { getCanonicalDisplayDomain } from '@/lib/domain-utils';
import { formatExtensionCampaignScalar } from '@/lib/extension-campaign-scalars';

export type ExtensionLiveCampaignPayload = {
  id: string;
  name: string;
  targetAudience: string;
  campaignType: string;
  frequencyType: string;
  frequencyCount: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  platformIds: string[];
  countryCodes: string[];
  ad?: {
    title: string;
    image: string | null;
    description: string | null;
    redirectUrl: string | null;
    htmlCode: string | null;
    displayAs?: 'inline' | 'popup';
  };
  notification?: { title: string; message: string; ctaLink: string | null };
  redirect?: {
    sourceDomain: string;
    includeSubdomains: boolean;
    destinationUrl: string;
  };
};

export type ExtensionLiveInitPayload = {
  user: ReturnType<typeof endUserPublicPayload> | null;
  /** Canonical display hostnames (deduped). */
  domains: string[];
  /** Platform id + raw domain for matching `campaign.platformIds`. */
  platforms: { id: string; domain: string }[];
  campaigns: ExtensionLiveCampaignPayload[];
  frequencyCounts: Record<string, number>;
};

export type ExtensionLiveCampaignUpdatePayload = {
  campaignId: string;
  campaign: ExtensionLiveCampaignPayload | null;
};

export type CampaignSelectRow = {
  id: string;
  name: string;
  targetAudience: string;
  campaignType: string;
  frequencyType: string;
  frequencyCount: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  adId: string | null;
  notificationId: string | null;
  redirectId: string | null;
  platformIds: string[] | null;
  countryCodes: string[] | null;
};

function serializeCampaignBase(c: CampaignSelectRow): Omit<
  ExtensionLiveCampaignPayload,
  'ad' | 'notification' | 'redirect'
> {
  return {
    id: c.id,
    name: c.name,
    targetAudience: c.targetAudience,
    campaignType: c.campaignType,
    frequencyType: c.frequencyType,
    frequencyCount: c.frequencyCount,
    timeStart: formatExtensionCampaignScalar(c.timeStart),
    timeEnd: formatExtensionCampaignScalar(c.timeEnd),
    status: c.status,
    startDate: c.startDate ? c.startDate.toISOString() : null,
    endDate: c.endDate ? c.endDate.toISOString() : null,
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
  };
}

export async function hydrateCampaignPayloads(
  rows: CampaignSelectRow[]
): Promise<ExtensionLiveCampaignPayload[]> {
  const adIds = new Set<string>();
  const notificationIds = new Set<string>();
  const redirectIds = new Set<string>();
  const displayAsByAd = new Map<string, 'inline' | 'popup'>();

  for (const c of rows) {
    if ((c.campaignType === 'ads' || c.campaignType === 'popup') && c.adId) {
      adIds.add(c.adId);
      displayAsByAd.set(c.adId, c.campaignType === 'popup' ? 'popup' : 'inline');
    }
    if (c.campaignType === 'notification' && c.notificationId) {
      notificationIds.add(c.notificationId);
    }
    if (c.campaignType === 'redirect' && c.redirectId) {
      redirectIds.add(c.redirectId);
    }
  }

  const [adList, notifList, redirectList] = await Promise.all([
    adIds.size
      ? db
          .select({
            id: ads.id,
            name: ads.name,
            description: ads.description,
            imageUrl: ads.imageUrl,
            targetUrl: ads.targetUrl,
            htmlCode: ads.htmlCode,
          })
          .from(ads)
          .where(inArray(ads.id, [...adIds]))
      : [],
    notificationIds.size
      ? db
          .select({
            id: notifications.id,
            title: notifications.title,
            message: notifications.message,
            ctaLink: notifications.ctaLink,
          })
          .from(notifications)
          .where(inArray(notifications.id, [...notificationIds]))
      : [],
    redirectIds.size
      ? db
          .select({
            id: redirects.id,
            sourceDomain: redirects.sourceDomain,
            includeSubdomains: redirects.includeSubdomains,
            destinationUrl: redirects.destinationUrl,
          })
          .from(redirects)
          .where(inArray(redirects.id, [...redirectIds]))
      : [],
  ]);

  const adMap = new Map(adList.map((a) => [a.id, a]));
  const notifMap = new Map(notifList.map((n) => [n.id, n]));
  const redirectMap = new Map(redirectList.map((r) => [r.id, r]));

  return rows.map((c) => {
    const base = serializeCampaignBase(c);
    if (c.campaignType === 'ads' || c.campaignType === 'popup') {
      const ad = c.adId ? adMap.get(c.adId) : undefined;
      if (ad) {
        return {
          ...base,
          ad: {
            title: ad.name,
            image: ad.imageUrl,
            description: ad.description ?? null,
            redirectUrl: ad.targetUrl ?? null,
            htmlCode: ad.htmlCode ?? null,
            displayAs: displayAsByAd.get(ad.id) ?? 'inline',
          },
        };
      }
    }
    if (c.campaignType === 'notification') {
      const n = c.notificationId ? notifMap.get(c.notificationId) : undefined;
      if (n) {
        return {
          ...base,
          notification: {
            title: n.title,
            message: n.message,
            ctaLink: n.ctaLink ?? null,
          },
        };
      }
    }
    if (c.campaignType === 'redirect') {
      const r = c.redirectId ? redirectMap.get(c.redirectId) : undefined;
      if (r) {
        return {
          ...base,
          redirect: {
            sourceDomain: r.sourceDomain,
            includeSubdomains: r.includeSubdomains,
            destinationUrl: r.destinationUrl,
          },
        };
      }
    }
    return base;
  });
}

export const extensionCampaignSelectShape = {
  id: campaigns.id,
  name: campaigns.name,
  targetAudience: campaigns.targetAudience,
  campaignType: campaigns.campaignType,
  frequencyType: campaigns.frequencyType,
  frequencyCount: campaigns.frequencyCount,
  timeStart: campaigns.timeStart,
  timeEnd: campaigns.timeEnd,
  status: campaigns.status,
  startDate: campaigns.startDate,
  endDate: campaigns.endDate,
  adId: campaigns.adId,
  notificationId: campaigns.notificationId,
  redirectId: campaigns.redirectId,
  platformIds: campaigns.platformIds,
  countryCodes: campaigns.countryCodes,
} as const;

/** Active campaigns whose schedule window includes `now` (status + start/end dates). */
export async function fetchActiveCampaignRowsForExtension(
  now: Date = new Date()
): Promise<CampaignSelectRow[]> {
  const campaignRows = await db
    .select(extensionCampaignSelectShape)
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'active'),
        or(isNull(campaigns.startDate), lte(campaigns.startDate, now)),
        or(isNull(campaigns.endDate), gte(campaigns.endDate, now))
      )
    );
  return campaignRows as CampaignSelectRow[];
}

/** Active ads, popup, and redirect campaigns (for `/api/extension/serve/ads`). */
export async function fetchActiveServeAdsCampaignRowsForExtension(
  now: Date = new Date()
): Promise<CampaignSelectRow[]> {
  const campaignRows = await db
    .select(extensionCampaignSelectShape)
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'active'),
        or(isNull(campaigns.startDate), lte(campaigns.startDate, now)),
        or(isNull(campaigns.endDate), gte(campaigns.endDate, now)),
        or(
          eq(campaigns.campaignType, 'ads'),
          eq(campaigns.campaignType, 'popup'),
          eq(campaigns.campaignType, 'redirect')
        )
      )
    );
  return campaignRows as CampaignSelectRow[];
}

export async function fetchExtensionPlatformsList(): Promise<{ id: string; domain: string }[]> {
  const platformRows = await db.select({ id: platforms.id, domain: platforms.domain }).from(platforms);
  return platformRows
    .map((r) => ({ id: r.id, domain: (r.domain ?? '').trim() }))
    .filter((p) => p.domain);
}

export async function buildExtensionLiveInit(endUser: EndUserRow | null): Promise<ExtensionLiveInitPayload> {
  const platformsPublic = await fetchExtensionPlatformsList();
  const domains = platformsPublic
    .map((p) => getCanonicalDisplayDomain(p.domain))
    .filter((d, i, arr) => arr.indexOf(d) === i);

  if (!endUser) {
    return {
      user: null,
      domains,
      platforms: platformsPublic,
      campaigns: [],
      frequencyCounts: {},
    };
  }

  const now = new Date();
  const campaignRows = await fetchActiveCampaignRowsForExtension(now);

  const rowsTyped = campaignRows;
  const out = await hydrateCampaignPayloads(rowsTyped);

  const frequencyCounts = await fetchFrequencyCountsForEndUser(String(endUser.id), rowsTyped.map((c) => c.id));

  return {
    user: endUserPublicPayload(endUser),
    domains,
    platforms: platformsPublic,
    campaigns: out,
    frequencyCounts,
  };
}

/** Event counts per campaign for active-in-window campaigns (all event types). */
export async function fetchFrequencyCountsForEndUser(
  endUserId: string,
  campaignIds: string[]
): Promise<Record<string, number>> {
  const frequencyCounts: Record<string, number> = {};
  if (campaignIds.length === 0) return frequencyCounts;

  const viewCountRows = await db
    .select({
      campaignId: enduserEvents.campaignId,
      viewCount: sql<number>`COUNT(*)::int`.as('view_count'),
    })
    .from(enduserEvents)
    .where(and(eq(enduserEvents.endUserId, endUserId), inArray(enduserEvents.campaignId, campaignIds)))
    .groupBy(enduserEvents.campaignId);
  for (const row of viewCountRows) {
    if (row.campaignId) frequencyCounts[row.campaignId] = Number(row.viewCount);
  }
  return frequencyCounts;
}

/** Used when a campaign is created/updated/deleted — may be inactive or missing (deleted). */
export async function buildCampaignUpdateForExtension(
  campaignId: string
): Promise<ExtensionLiveCampaignUpdatePayload> {
  const [c] = await db
    .select(extensionCampaignSelectShape)
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!c) {
    return { campaignId, campaign: null };
  }
  if (c.status === 'deleted') {
    return { campaignId, campaign: null };
  }

  const [payload] = await hydrateCampaignPayloads([c as CampaignSelectRow]);
  return { campaignId, campaign: payload };
}
