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
  fetchActiveCampaignRowsForExtension,
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
import { computeExtensionDaysLeft } from '@/lib/extension-user-subscription';

export type ExtensionAdBlockPublicAd = {
  title: string;
  image: string | null;
  description: string | null;
  redirectUrl: string | null;
  htmlCode: string | null;
  displayAs?: 'inline' | 'popup';
};

export type ExtensionAdBlockPublicNotification = {
  title: string;
  message: string;
  ctaLink: string | null;
};

export type ExtensionAdBlockPublicRedirect = {
  sourceDomain: string;
  includeSubdomains: boolean;
  destinationUrl: string;
};

export class ExtensionAdBlockError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ExtensionAdBlockError';
  }
}

export function assertExtensionEndUserAccess(endUser: EndUserRow): void {
  const daysLeft = computeExtensionDaysLeft({
    endDate: endUser.endDate,
    plan: endUser.plan,
    startDate: endUser.startDate,
  });
  if (daysLeft !== null && daysLeft <= 0) {
    throw new ExtensionAdBlockError('Access ended', 403, { error: 'trial_expired' });
  }
}

function campaignMatchesVisitDomain(
  c: CampaignSelectRow,
  platformIdSetForVisit: Set<string>
): boolean {
  const pids = c.platformIds ?? [];
  if (c.campaignType === 'notification' || c.campaignType === 'redirect') {
    if (pids.length === 0) return true;
    return pids.some((id) => platformIdSetForVisit.has(id));
  }
  if (pids.length === 0) return false;
  return pids.some((id) => platformIdSetForVisit.has(id));
}

/** Drop campaign types the client did not ask for so we do not fetch counts / hydrate unrelated rows. */
function campaignMatchesRequestChannel(
  c: CampaignSelectRow,
  wantsAds: boolean,
  wantsNotifications: boolean
): boolean {
  if (wantsAds && wantsNotifications) return true;
  if (wantsAds && !wantsNotifications) {
    return c.campaignType === 'ads' || c.campaignType === 'popup' || c.campaignType === 'redirect';
  }
  if (!wantsAds && wantsNotifications) {
    return c.campaignType === 'notification';
  }
  return false;
}

export function geoCountryFromRequest(request: NextRequest): string | null {
  const cf = request.headers.get('cf-ipcountry')?.trim().toUpperCase();
  if (cf && cf.length === 2) return cf;
  const vercel = request.headers.get('x-vercel-ip-country')?.trim().toUpperCase();
  if (vercel && vercel.length === 2) return vercel;
  return null;
}

export async function runExtensionAdBlock(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain: string | undefined;
  requestType?: 'ad' | 'notification';
  /** Optional body `userAgent` when the runtime strips browser headers */
  userAgent?: string | null;
}): Promise<{
  ads: ExtensionAdBlockPublicAd[];
  notifications: ExtensionAdBlockPublicNotification[];
  redirects: ExtensionAdBlockPublicRedirect[];
}> {
  const { endUser, request, domain: rawDomain, requestType } = params;

  assertExtensionEndUserAccess(endUser);

  const wantsAds = requestType !== 'notification';
  const wantsNotifications = requestType !== 'ad';

  const normalizedDomain = rawDomain?.trim()
    ? normalizeDomainForMatch(rawDomain)
    : '';

  const platformRows = await db
    .select({ id: platforms.id, domain: platforms.domain })
    .from(platforms);

  const platformIdSetForVisit = platformIdSetForNormalizedDomain(normalizedDomain, platformRows);

  const now = new Date();
  const activeRows = await fetchActiveCampaignRowsForExtension(now);
  const domainScoped = activeRows.filter((c) =>
    campaignMatchesVisitDomain(c, platformIdSetForVisit)
  );
  const requestScoped = domainScoped.filter((c) =>
    campaignMatchesRequestChannel(c, wantsAds, wantsNotifications)
  );

  const endUserIdStr = String(endUser.id);
  const frequencyCounts = await fetchFrequencyCountsForEndUser(
    endUserIdStr,
    requestScoped.map((c) => c.id)
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

  const rules = requestScoped.map(campaignSelectRowToRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = requestScoped.filter((c) => qualifiedIds.has(c.id));

  const hydrated = await hydrateCampaignPayloads(qualifiedRows);

  const ads: ExtensionAdBlockPublicAd[] = [];
  const notifications: ExtensionAdBlockPublicNotification[] = [];
  const redirects: ExtensionAdBlockPublicRedirect[] = [];

  const logDomain = normalizedDomain ? normalizedDomain.slice(0, 255) : null;
  const emailVal = endUser.email?.trim() ? endUser.email.trim().slice(0, 255) : null;

  for (const h of hydrated) {
    if (wantsAds && h.ad && (h.campaignType === 'ads' || h.campaignType === 'popup')) {
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
    if (wantsNotifications && h.notification && h.campaignType === 'notification') {
      notifications.push({
        title: h.notification.title,
        message: h.notification.message,
        ctaLink: h.notification.ctaLink,
      });
      await db.insert(enduserEvents).values({
        endUserId: endUserIdStr,
        email: emailVal,
        plan: endUser.plan,
        campaignId: h.id,
        domain: logDomain,
        type: 'notification',
        country: geo,
        userAgent: ua,
      });
    }
    if (
      wantsAds &&
      normalizedDomain &&
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
    }
  }

  return { ads, notifications, redirects };
}
