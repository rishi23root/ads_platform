import 'server-only';

import type { NextRequest } from 'next/server';
import { and, eq, gte, inArray, isNull, lte, min, or, sql } from 'drizzle-orm';
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
import { countryCodeFromRequestHeaders } from '@/lib/enduser-request-country';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';
import {
  getCanonicalDisplayDomain,
  redirectSourceToHostnameRegex,
} from '@/lib/domain-utils';
import { formatExtensionCampaignScalar } from '@/lib/extension-campaign-scalars';
import {
  currentLocalMinutesSinceMidnight,
  filterQualifyingExtensionCampaigns,
  isExtensionUserNewForAdBlock,
  type ExtensionCampaignQualifyContext,
} from '@/lib/extension-ad-block-qualify';
import { campaignSelectRowToRuleFields } from '@/lib/extension-campaign-rule-mapper';
import {
  getCachedActiveCampaigns,
  setCachedActiveCampaigns,
  EXTENSION_CAMPAIGNS_KEYS,
} from '@/lib/redis';
import { computeTargetListMembershipForUser } from '@/lib/target-list-queries';

// ============ Shared campaign row type (used by serve handlers too) ============

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
  /** DB returns `Date`; Redis JSON cache restores ISO strings. */
  startDate: Date | string | null;
  endDate: Date | string | null;
  adId: string | null;
  notificationId: string | null;
  redirectId: string | null;
  platformIds: string[] | null;
  countryCodes: string[] | null;
  targetListId?: string | null;
};

// ============ Full hydrated campaign payload (used by serve handlers + SSE init redirect build) ============

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
  targetListId: string | null;
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

/** POST /api/extension/serve — creative-only rows (targeting and caps already applied server-side). */
export type ExtensionServeCreativeAdBody = {
  title: string;
  image: string | null;
  description: string | null;
  redirectUrl: string | null;
  htmlCode: string | null;
  displayAs: 'inline' | 'popup';
};

export type ExtensionServeCreativePayload =
  | { id: string; ad: ExtensionServeCreativeAdBody }
  | { id: string; notification: { title: string; message: string; ctaLink: string | null } };

export type ExtensionServeCreativesResult = {
  ads: ExtensionServeCreativePayload[];
  popups: ExtensionServeCreativePayload[];
  notifications: ExtensionServeCreativePayload[];
};

/**
 * SSE `campaign_updated` — refreshed `domains` plus the full qualifying `redirects` list for this user
 * (same shape as `init.redirects` / `redirects_updated`), so clients replace cached rules in one step.
 */
export type ExtensionLiveCampaignUpdatePayload = {
  domains: string[];
  redirects: ExtensionInitRedirectItem[];
};

// ============ SSE init payload (slimmed) ============

/** A redirect rule delivered in the SSE `init` event, including cap metadata for the extension. */
export type ExtensionInitRedirectItem = {
  campaignId: string;
  /** Hostname regex pattern aligned with `redirectSourceToHostnameRegex`. */
  domain_regex: string;
  target_url: string;
  date_till: string | null;
  /** This user's current event count for this campaign. */
  count: number;
  frequencyType: string;
  frequencyCount: number | null;
};

export type ExtensionLiveInitPayload = {
  user: ReturnType<typeof endUserPublicPayload> | null;
  /**
   * Canonical hostnames derived from platforms referenced by active campaigns.
   * The extension uses this to decide when to call `serve` for ads, popups, and notifications.
   */
  domains: string[];
  /**
   * Redirect (rewrite) rules that qualify for this user, with cap metadata.
   * Ads and notifications are NOT in init — the extension requests them per-domain via `serve`.
   */
  redirects: ExtensionInitRedirectItem[];
};

// ============ DB select shape ============

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
  targetListId: campaigns.targetListId,
} as const;

// ============ Campaign fetch helpers (also used by extension-serve-handlers) ============

/** All active-in-window campaigns (all types). */
export async function fetchActiveCampaignRowsForExtension(
  now: Date = new Date()
): Promise<CampaignSelectRow[]> {
  const cached = await getCachedActiveCampaigns<CampaignSelectRow>(EXTENSION_CAMPAIGNS_KEYS.all);
  if (cached) return cached;

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
  const rows = campaignRows as CampaignSelectRow[];
  await setCachedActiveCampaigns(EXTENSION_CAMPAIGNS_KEYS.all, rows);
  return rows;
}

/** Active redirect campaigns (Redis-cached slice; used by internal tooling/tests if needed). */
export async function fetchActiveRedirectCampaignRowsForExtension(
  now: Date = new Date()
): Promise<CampaignSelectRow[]> {
  const cached = await getCachedActiveCampaigns<CampaignSelectRow>(EXTENSION_CAMPAIGNS_KEYS.redirects);
  if (cached) return cached;

  const campaignRows = await db
    .select(extensionCampaignSelectShape)
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'active'),
        or(isNull(campaigns.startDate), lte(campaigns.startDate, now)),
        or(isNull(campaigns.endDate), gte(campaigns.endDate, now)),
        eq(campaigns.campaignType, 'redirect')
      )
    );
  const rows = campaignRows as CampaignSelectRow[];
  await setCachedActiveCampaigns(EXTENSION_CAMPAIGNS_KEYS.redirects, rows);
  return rows;
}

export async function fetchExtensionPlatformsList(): Promise<{ id: string; domain: string }[]> {
  const platformRows = await db.select({ id: platforms.id, domain: platforms.domain }).from(platforms);
  return platformRows
    .map((r) => ({ id: r.id, domain: (r.domain ?? '').trim() }))
    .filter((p) => p.domain);
}

// ============ Frequency count helper (also used by extension-serve-handlers) ============

/** Event counts per campaign for this user (all event types). */
export async function fetchFrequencyCountsForEndUser(
  userIdentifier: string,
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
    .where(
      and(
        eq(enduserEvents.userIdentifier, userIdentifier),
        inArray(enduserEvents.campaignId, campaignIds)
      )
    )
    .groupBy(enduserEvents.campaignId);

  for (const row of viewCountRows) {
    if (row.campaignId) frequencyCounts[row.campaignId] = Number(row.viewCount);
  }
  return frequencyCounts;
}

// ============ Account-age helpers (exported so extension-serve-handlers can use them) ============

export async function fetchFirstEventCreatedAt(userIdentifier: string): Promise<Date | null> {
  const [row] = await db
    .select({ firstAt: min(enduserEvents.createdAt) })
    .from(enduserEvents)
    .where(eq(enduserEvents.userIdentifier, userIdentifier));
  return row?.firstAt ?? null;
}

/** Anchor "account age": earliest of first telemetry event and `end_users.startDate`. */
export function newUserAnchorDate(endUser: EndUserRow, firstEventAt: Date | null): Date {
  const start = endUser.startDate;
  if (!firstEventAt) return start;
  return firstEventAt.getTime() < start.getTime() ? firstEventAt : start;
}

/**
 * Builds `ExtensionCampaignQualifyContext` for extension serving and SSE init.
 * When `request` is omitted, geo uses `endUser.country` only. When set, request headers
 * (e.g. CF-IPCountry) win over the stored country, matching `POST /api/extension/serve`.
 */
export async function buildExtensionCampaignQualifyContext(
  endUser: EndUserRow,
  campaignIds: string[],
  targetListIds: string[] = [],
  request?: NextRequest
): Promise<ExtensionCampaignQualifyContext> {
  const userIdentifier = userIdentifierForEndUser(endUser);
  const [firstEventAt, frequencyCountsRecord, targetListMembership] = await Promise.all([
    fetchFirstEventCreatedAt(userIdentifier),
    fetchFrequencyCountsForEndUser(userIdentifier, campaignIds),
    computeTargetListMembershipForUser(targetListIds, endUser),
  ]);

  const viewCountByCampaignId = new Map<string, number>();
  for (const [id, n] of Object.entries(frequencyCountsRecord)) {
    viewCountByCampaignId.set(id, n);
  }

  const now = new Date();
  const anchor = newUserAnchorDate(endUser, firstEventAt);

  let endUserGeoCountry: string | null;
  if (request) {
    const fromHeaders = countryCodeFromRequestHeaders(request);
    if (fromHeaders) endUserGeoCountry = fromHeaders;
    else {
      const fromRow = endUser.country?.trim().toUpperCase();
      endUserGeoCountry = fromRow && fromRow.length === 2 ? fromRow : null;
    }
  } else {
    const storedCountry = endUser.country?.trim().toUpperCase();
    endUserGeoCountry = storedCountry && storedCountry.length === 2 ? storedCountry : null;
  }

  return {
    now,
    currentMinutes: currentLocalMinutesSinceMidnight(now),
    isNewUser: isExtensionUserNewForAdBlock(anchor),
    endUserGeoCountry,
    viewCountByCampaignId,
    targetListMembership,
  };
}

// ============ Domain derivation helper ============

/**
 * Returns campaign-referenced canonical display hostnames.
 *
 * If any active campaign has an empty `platformIds` (= targets all platforms), every platform's
 * canonical domain is included so the extension does not miss any serve surface.
 */
export function buildCampaignUsedDomains(
  campaignRows: CampaignSelectRow[],
  allPlatforms: { id: string; domain: string }[]
): string[] {
  const anyGlobal = campaignRows.some((c) => !c.platformIds || c.platformIds.length === 0);
  const platformMap = new Map(allPlatforms.map((p) => [p.id, p.domain]));

  const usedDomains = new Set<string>();

  if (anyGlobal) {
    for (const p of allPlatforms) {
      const canonical = getCanonicalDisplayDomain(p.domain);
      if (canonical) usedDomains.add(canonical);
    }
  } else {
    for (const c of campaignRows) {
      for (const id of c.platformIds ?? []) {
        const domain = platformMap.get(id);
        if (domain) {
          const canonical = getCanonicalDisplayDomain(domain);
          if (canonical) usedDomains.add(canonical);
        }
      }
    }
  }

  return [...usedDomains];
}

/**
 * Fetches active campaign rows + all platforms from DB/cache, then derives campaign-used domains.
 * Exported for use by the SSE `platforms_updated` handler in the live route.
 */
export async function buildCampaignUsedDomainsFromDB(): Promise<string[]> {
  const now = new Date();
  const [campaignRows, allPlatforms] = await Promise.all([
    fetchActiveCampaignRowsForExtension(now),
    fetchExtensionPlatformsList(),
  ]);
  return buildCampaignUsedDomains(campaignRows, allPlatforms);
}

// ============ Campaign payload hydration (used by serve handlers + SSE init) ============

function extensionCampaignDateToIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

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
    startDate: extensionCampaignDateToIso(c.startDate),
    endDate: extensionCampaignDateToIso(c.endDate),
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
    targetListId: c.targetListId ?? null,
  };
}

type AdHydrationRow = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  targetUrl: string | null;
  htmlCode: string | null;
};

type NotificationHydrationRow = {
  id: string;
  title: string;
  message: string;
  ctaLink: string | null;
};

type RedirectHydrationRow = {
  id: string;
  sourceDomain: string;
  includeSubdomains: boolean;
  destinationUrl: string;
};

async function loadExtensionCampaignCreativeMaps(rows: CampaignSelectRow[]): Promise<{
  adMap: Map<string, AdHydrationRow>;
  notifMap: Map<string, NotificationHydrationRow>;
  redirectMap: Map<string, RedirectHydrationRow>;
}> {
  const adIds = new Set<string>();
  const notificationIds = new Set<string>();
  const redirectIds = new Set<string>();

  for (const c of rows) {
    if ((c.campaignType === 'ads' || c.campaignType === 'popup') && c.adId) {
      adIds.add(c.adId);
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

  return {
    adMap: new Map(adList.map((a) => [a.id, a])),
    notifMap: new Map(notifList.map((n) => [n.id, n])),
    redirectMap: new Map(redirectList.map((r) => [r.id, r])),
  };
}

/** Partitioned creatives for POST /api/extension/serve (minimal JSON per item). */
export async function buildServeCreativeBuckets(
  rows: CampaignSelectRow[]
): Promise<ExtensionServeCreativesResult> {
  const { adMap, notifMap } = await loadExtensionCampaignCreativeMaps(rows);
  const ads: ExtensionServeCreativePayload[] = [];
  const popups: ExtensionServeCreativePayload[] = [];
  const notifications: ExtensionServeCreativePayload[] = [];

  for (const c of rows) {
    if (c.campaignType === 'ads' || c.campaignType === 'popup') {
      const ad = c.adId ? adMap.get(c.adId) : undefined;
      if (!ad) continue;
      const item: ExtensionServeCreativePayload = {
        id: c.id,
        ad: {
          title: ad.name,
          image: ad.imageUrl,
          description: ad.description ?? null,
          redirectUrl: ad.targetUrl ?? null,
          htmlCode: ad.htmlCode ?? null,
          displayAs: c.campaignType === 'popup' ? 'popup' : 'inline',
        },
      };
      if (c.campaignType === 'ads') {
        ads.push(item);
      } else {
        popups.push(item);
      }
    } else if (c.campaignType === 'notification') {
      const n = c.notificationId ? notifMap.get(c.notificationId) : undefined;
      if (!n) continue;
      notifications.push({
        id: c.id,
        notification: {
          title: n.title,
          message: n.message,
          ctaLink: n.ctaLink ?? null,
        },
      });
    }
  }

  return { ads, popups, notifications };
}

export async function hydrateCampaignPayloads(
  rows: CampaignSelectRow[]
): Promise<ExtensionLiveCampaignPayload[]> {
  const { adMap, notifMap, redirectMap } = await loadExtensionCampaignCreativeMaps(rows);

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
            displayAs: c.campaignType === 'popup' ? 'popup' : 'inline',
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

// ============ SSE init builder ============

async function buildQualifiedRedirectItemsForUser(
  endUser: EndUserRow,
  allCampaignRows: CampaignSelectRow[]
): Promise<ExtensionInitRedirectItem[]> {
  const redirectRows = allCampaignRows.filter((c) => c.campaignType === 'redirect');
  if (redirectRows.length === 0) return [];

  const targetListIds = Array.from(
    new Set(redirectRows.map((c) => c.targetListId).filter((x): x is string => Boolean(x)))
  );
  const ctx = await buildExtensionCampaignQualifyContext(
    endUser,
    redirectRows.map((c) => c.id),
    targetListIds
  );
  const rules = redirectRows.map(campaignSelectRowToRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = redirectRows.filter((c) => qualifiedIds.has(c.id));
  const hydrated = await hydrateCampaignPayloads(qualifiedRows);

  const redirectItems: ExtensionInitRedirectItem[] = [];
  for (const c of hydrated) {
    const r = c.redirect;
    if (!r) continue;
    redirectItems.push({
      campaignId: c.id,
      domain_regex: redirectSourceToHostnameRegex(r.sourceDomain, r.includeSubdomains),
      target_url: r.destinationUrl,
      date_till: c.endDate,
      count: ctx.viewCountByCampaignId.get(c.id) ?? 0,
      frequencyType: c.frequencyType,
      frequencyCount: c.frequencyCount,
    });
  }
  return redirectItems;
}

/** Full qualifying redirect list for an end user (same shape as `init.redirects`). Used by SSE `redirects_updated`. */
export async function buildExtensionLiveRedirectsForEndUser(
  endUser: EndUserRow
): Promise<ExtensionInitRedirectItem[]> {
  const now = new Date();
  const allCampaignRows = await fetchActiveCampaignRowsForExtension(now);
  return buildQualifiedRedirectItemsForUser(endUser, allCampaignRows);
}

export async function buildExtensionLiveInit(endUser: EndUserRow | null): Promise<ExtensionLiveInitPayload> {
  const now = new Date();
  const [allCampaignRows, allPlatforms] = await Promise.all([
    fetchActiveCampaignRowsForExtension(now),
    fetchExtensionPlatformsList(),
  ]);

  const domains = buildCampaignUsedDomains(allCampaignRows, allPlatforms);

  if (!endUser) {
    return { user: null, domains, redirects: [] };
  }

  const redirectItems = await buildQualifiedRedirectItemsForUser(endUser, allCampaignRows);

  return {
    user: endUserPublicPayload(endUser),
    domains,
    redirects: redirectItems,
  };
}

// ============ Campaign update helper (used by SSE live route on `campaign_updated`) ============

/** Same data as `redirects_updated`: full domain list + full redirect rules for this user. */
export async function buildCampaignUpdateForExtension(
  endUser: EndUserRow
): Promise<ExtensionLiveCampaignUpdatePayload> {
  const [domains, redirects] = await Promise.all([
    buildCampaignUsedDomainsFromDB(),
    buildExtensionLiveRedirectsForEndUser(endUser),
  ]);
  return { domains, redirects };
}
