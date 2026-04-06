import 'server-only';

import type { NextRequest } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents, platforms } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';
import {
  normalizeDomainForMatch,
  platformIdSetForNormalizedDomain,
  redirectSourceToHostnameRegex,
} from '@/lib/domain-utils';
import {
  type CampaignSelectRow,
  type ExtensionLiveCampaignPayload,
  fetchActiveRedirectCampaignRowsForExtension,
  fetchActiveServeAdsCampaignRowsForExtension,
  fetchFrequencyCountsForEndUser,
  hydrateCampaignPayloads,
} from '@/lib/extension-live-init';
import { campaignSelectRowToRuleFields } from '@/lib/extension-campaign-rule-mapper';
import {
  currentLocalMinutesSinceMidnight,
  filterQualifyingExtensionCampaigns,
  isExtensionUserNewForAdBlock,
  type ExtensionCampaignQualifyContext,
} from '@/lib/extension-ad-block-qualify';
import {
  assertExtensionEndUserAccess,
  ExtensionAdBlockError,
  ExtensionAdBlockPublicAd,
  geoCountryFromRequest,
} from '@/lib/extension-ad-block-handler';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';

/** Same platform scoping as ad-block for ads/popup vs redirect (redirect may use empty platformIds). */
function campaignMatchesVisitDomainServeAds(
  c: CampaignSelectRow,
  platformIdSetForVisit: Set<string>
): boolean {
  const pids = c.platformIds ?? [];
  if (c.campaignType === 'redirect') {
    if (pids.length === 0) return true;
    return pids.some((id) => platformIdSetForVisit.has(id));
  }
  if (pids.length === 0) return false;
  return pids.some((id) => platformIdSetForVisit.has(id));
}

export type ExtensionServeRedirectItem = {
  /** Use in `POST /api/extension/events` as `campaignId` when reporting `type: "redirect"`. */
  campaignId: string;
  /** Match with `new RegExp(domain_regex, 'i').test(normalizedVisitHostname)`. */
  domain_regex: string;
  target_url: string;
  /** Campaign end instant (ISO 8601), or `null` if no end date on the campaign. */
  date_till: string | null;
  /** Redirect/event budget for this user: how many times this campaign already counted, cap (if any), and slots left. */
  count: {
    used: number;
    max: number | null;
    remaining: number | null;
  };
};

function redirectServeCountForCampaign(
  h: ExtensionLiveCampaignPayload,
  used: number
): ExtensionServeRedirectItem['count'] {
  const ft = h.frequencyType;
  if (ft === 'only_once') {
    const max = 1;
    return { used, max, remaining: Math.max(0, max - used) };
  }
  if (ft === 'specific_count' && h.frequencyCount != null) {
    const max = h.frequencyCount;
    return { used, max, remaining: Math.max(0, max - used) };
  }
  return { used, max: null, remaining: null };
}

export async function runServeAds(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain: string | undefined;
  userAgent?: string | null;
}): Promise<{ ads: ExtensionAdBlockPublicAd[] }> {
  const { endUser, request, domain: rawDomain } = params;

  assertExtensionEndUserAccess(endUser);

  const normalizedDomain = rawDomain?.trim() ? normalizeDomainForMatch(rawDomain) : '';
  if (!normalizedDomain) {
    throw new ExtensionAdBlockError('domain is required', 400, {
      error: 'Validation failed',
      details: { domain: ['domain is required'] },
    });
  }

  const platformRows = await db
    .select({ id: platforms.id, domain: platforms.domain })
    .from(platforms);

  const platformIdSetForVisit = platformIdSetForNormalizedDomain(normalizedDomain, platformRows);

  const now = new Date();
  const campaignRows = await fetchActiveServeAdsCampaignRowsForExtension(now);
  const domainScoped = campaignRows.filter((c) =>
    campaignMatchesVisitDomainServeAds(c, platformIdSetForVisit)
  );

  const uid = userIdentifierForEndUser(endUser);
  const frequencyCounts = await fetchFrequencyCountsForEndUser(uid, domainScoped.map((c) => c.id));

  const isNewUser = isExtensionUserNewForAdBlock(endUser.startDate);
  const geo = geoCountryFromRequest(request);
  const ua =
    params.userAgent?.trim().slice(0, 2000) ||
    request.headers.get('user-agent')?.trim().slice(0, 2000) ||
    null;

  const ctx: ExtensionCampaignQualifyContext = {
    now,
    currentMinutes: currentLocalMinutesSinceMidnight(now),
    isNewUser,
    endUserGeoCountry: geo,
    viewCountByCampaignId: new Map(Object.entries(frequencyCounts).map(([k, v]) => [k, v])),
  };

  const rules = domainScoped.map(campaignSelectRowToRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = domainScoped.filter((c) => qualifiedIds.has(c.id));

  const hydrated = await hydrateCampaignPayloads(qualifiedRows);

  const ads: ExtensionAdBlockPublicAd[] = [];
  const logDomain = normalizedDomain.slice(0, 255);

  for (const h of hydrated) {
    if (h.ad && (h.campaignType === 'ads' || h.campaignType === 'popup')) {
      ads.push({
        title: h.ad.title,
        image: h.ad.image,
        description: h.ad.description,
        redirectUrl: h.ad.redirectUrl,
        htmlCode: h.ad.htmlCode,
        displayAs: h.ad.displayAs,
      });
      const evType = h.campaignType === 'popup' ? 'popup' : 'ad';
      await db.insert(enduserEvents).values({
        userIdentifier: uid,
        campaignId: h.id,
        domain: logDomain,
        type: evType,
        country: geo,
        userAgent: ua,
      });
    }
  }

  return { ads };
}

/**
 * Redirect campaigns for the extension: schedule + frequency/count + geo + audience + optional platform scope.
 * Does not log `enduser_events` (use `POST /events` when the client actually redirects).
 */
export async function runServeRedirects(params: {
  endUser: EndUserRow;
  request: NextRequest;
  /** When set, only campaigns whose `platformIds` match this host are included (same as serve/ads). */
  domain?: string | null;
}): Promise<{ redirects: ExtensionServeRedirectItem[] }> {
  const { endUser, request } = params;

  assertExtensionEndUserAccess(endUser);

  const platformRows = await db
    .select({ id: platforms.id, domain: platforms.domain })
    .from(platforms);

  const rawDomain = params.domain?.trim() || '';
  const normalizedDomain = rawDomain ? normalizeDomainForMatch(rawDomain) : '';
  const platformIdSetForVisit = normalizedDomain
    ? platformIdSetForNormalizedDomain(normalizedDomain, platformRows)
    : null;

  const now = new Date();
  const campaignRows = await fetchActiveRedirectCampaignRowsForExtension(now);
  const scoped =
    platformIdSetForVisit === null
      ? campaignRows
      : campaignRows.filter((c) =>
          campaignMatchesVisitDomainServeAds(c, platformIdSetForVisit)
        );

  const uid = userIdentifierForEndUser(endUser);
  const frequencyCounts = await fetchFrequencyCountsForEndUser(
    uid,
    scoped.map((c) => c.id)
  );

  const isNewUser = isExtensionUserNewForAdBlock(endUser.startDate);
  const geo = geoCountryFromRequest(request);

  const ctx: ExtensionCampaignQualifyContext = {
    now,
    currentMinutes: currentLocalMinutesSinceMidnight(now),
    isNewUser,
    endUserGeoCountry: geo,
    viewCountByCampaignId: new Map(Object.entries(frequencyCounts).map(([k, v]) => [k, v])),
  };

  const rules = scoped.map(campaignSelectRowToRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = scoped.filter((c) => qualifiedIds.has(c.id));

  const hydrated = await hydrateCampaignPayloads(qualifiedRows);
  const redirects: ExtensionServeRedirectItem[] = [];

  for (const h of hydrated) {
    if (h.redirect && h.campaignType === 'redirect') {
      const used = frequencyCounts[h.id] ?? 0;
      redirects.push({
        campaignId: h.id,
        domain_regex: redirectSourceToHostnameRegex(
          h.redirect.sourceDomain,
          h.redirect.includeSubdomains
        ),
        target_url: h.redirect.destinationUrl,
        date_till: h.endDate,
        count: redirectServeCountForCampaign(h, used),
      });
    }
  }

  return { redirects };
}
