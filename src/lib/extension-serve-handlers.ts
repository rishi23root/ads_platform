import 'server-only';

import type { NextRequest } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents, platforms } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';
import {
  normalizeDomainForMatch,
  platformIdSetForNormalizedDomain,
  redirectSourceMatchesVisit,
} from '@/lib/domain-utils';
import {
  type CampaignSelectRow,
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
  ExtensionAdBlockPublicRedirect,
  geoCountryFromRequest,
} from '@/lib/extension-ad-block-handler';

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

export async function runServeAds(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain: string | undefined;
  userAgent?: string | null;
}): Promise<{ ads: ExtensionAdBlockPublicAd[]; redirects: ExtensionAdBlockPublicRedirect[] }> {
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

  const endUserIdStr = String(endUser.id);
  const frequencyCounts = await fetchFrequencyCountsForEndUser(
    endUserIdStr,
    domainScoped.map((c) => c.id)
  );

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
  const redirects: ExtensionAdBlockPublicRedirect[] = [];
  const logDomain = normalizedDomain.slice(0, 255);
  const emailVal = endUser.email?.trim() ? endUser.email.trim().slice(0, 255) : null;

  let servedInventory = false;
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
        endUserId: endUserIdStr,
        email: emailVal,
        plan: endUser.plan,
        campaignId: h.id,
        domain: logDomain,
        type: evType,
        country: geo,
        userAgent: ua,
      });
      servedInventory = true;
    }
    if (
      h.redirect &&
      h.campaignType === 'redirect' &&
      redirectSourceMatchesVisit(
        normalizedDomain,
        h.redirect.sourceDomain,
        h.redirect.includeSubdomains
      )
    ) {
      redirects.push({
        sourceDomain: h.redirect.sourceDomain,
        includeSubdomains: h.redirect.includeSubdomains,
        destinationUrl: h.redirect.destinationUrl,
      });
      await db.insert(enduserEvents).values({
        endUserId: endUserIdStr,
        email: emailVal,
        plan: endUser.plan,
        campaignId: h.id,
        domain: logDomain,
        type: 'redirect',
        country: geo,
        userAgent: ua,
      });
      servedInventory = true;
    }
  }

  if (!servedInventory) {
    await db.insert(enduserEvents).values({
      endUserId: endUserIdStr,
      email: emailVal,
      plan: endUser.plan,
      campaignId: null,
      domain: logDomain,
      type: 'request',
      country: geo,
      userAgent: ua,
    });
  }

  return { ads, redirects };
}
