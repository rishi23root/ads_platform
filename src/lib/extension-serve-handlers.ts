import 'server-only';

import type { NextRequest } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents, platforms } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';
import { domainsMatch, normalizeDomainForMatch } from '@/lib/domain-utils';
import {
  type CampaignSelectRow,
  fetchActiveAdPopupCampaignRowsForExtension,
  fetchFrequencyCountsForEndUser,
  hydrateCampaignPayloads,
} from '@/lib/extension-live-init';
import {
  currentLocalMinutesSinceMidnight,
  filterQualifyingExtensionCampaigns,
  isExtensionUserNewForAdBlock,
  type ExtensionCampaignQualifyContext,
  type ExtensionCampaignRuleFields,
} from '@/lib/extension-ad-block-qualify';
import {
  ExtensionAdBlockError,
  ExtensionAdBlockPublicAd,
  geoCountryFromRequest,
} from '@/lib/extension-ad-block-handler';
import { computeExtensionDaysLeft } from '@/lib/extension-user-subscription';

function formatTime(t: unknown): string | null {
  if (t == null) return null;
  return String(t);
}

function toRuleFields(c: CampaignSelectRow): ExtensionCampaignRuleFields {
  return {
    id: c.id,
    targetAudience: c.targetAudience,
    frequencyType: c.frequencyType,
    frequencyCount: c.frequencyCount,
    timeStart: formatTime(c.timeStart),
    timeEnd: formatTime(c.timeEnd),
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    countryCodes: c.countryCodes,
  };
}

function campaignMatchesVisitDomainAdsOnly(
  c: CampaignSelectRow,
  platformIdSetForVisit: Set<string>
): boolean {
  const pids = c.platformIds ?? [];
  if (pids.length === 0) return false;
  return pids.some((id) => platformIdSetForVisit.has(id));
}

export async function runServeAds(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain: string | undefined;
  userAgent?: string | null;
}): Promise<{ ads: ExtensionAdBlockPublicAd[] }> {
  const { endUser, request, domain: rawDomain } = params;

  const daysLeft = computeExtensionDaysLeft({
    endDate: endUser.endDate,
    plan: endUser.plan,
    startDate: endUser.startDate,
  });
  if (daysLeft !== null && daysLeft <= 0) {
    throw new ExtensionAdBlockError('Access ended', 403, { error: 'trial_expired' });
  }

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

  const platformIdSetForVisit = new Set<string>();
  for (const p of platformRows) {
    const d = (p.domain ?? '').trim();
    if (d && domainsMatch(normalizedDomain, d)) {
      platformIdSetForVisit.add(p.id);
    }
  }

  const now = new Date();
  const adPopupRows = await fetchActiveAdPopupCampaignRowsForExtension(now);
  const domainScoped = adPopupRows.filter((c) =>
    campaignMatchesVisitDomainAdsOnly(c, platformIdSetForVisit)
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

  const rules = domainScoped.map(toRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = domainScoped.filter((c) => qualifiedIds.has(c.id));

  const hydrated = await hydrateCampaignPayloads(qualifiedRows);

  const ads: ExtensionAdBlockPublicAd[] = [];
  const logDomain = normalizedDomain.slice(0, 255);
  const emailVal = endUser.email?.trim() ? endUser.email.trim().slice(0, 255) : null;

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
    }
  }

  return { ads };
}
