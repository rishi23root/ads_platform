import 'server-only';

import { eq, min } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';
import {
  currentLocalMinutesSinceMidnight,
  filterQualifyingExtensionCampaigns,
  isExtensionUserNewForAdBlock,
  type ExtensionCampaignQualifyContext,
} from '@/lib/extension-ad-block-qualify';
import { campaignSelectRowToRuleFields } from '@/lib/extension-campaign-rule-mapper';
import type { CampaignSelectRow, ExtensionLiveCampaignPayload } from '@/lib/extension-live-init';
import {
  fetchActiveRedirectCampaignRowsForExtension,
  fetchActiveServeAdsCampaignRowsForExtension,
  fetchExtensionPlatformsList,
  fetchFrequencyCountsForEndUser,
  hydrateCampaignPayloads,
} from '@/lib/extension-live-init';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';
import { normalizeDomainForMatch, platformIdSetForNormalizedDomain, redirectSourceToHostnameRegex } from '@/lib/domain-utils';
import { countryCodeFromRequestHeaders } from '@/lib/enduser-request-country';
import { getCachedPlatformList, setCachedPlatformList } from '@/lib/redis';

function endUserGeoCountryFromRequest(request: NextRequest, endUser: EndUserRow): string | null {
  const fromHeaders = countryCodeFromRequestHeaders(request);
  if (fromHeaders) return fromHeaders;
  const fromRow = endUser.country?.trim().toUpperCase();
  return fromRow && fromRow.length === 2 ? fromRow : null;
}

async function fetchFirstEventCreatedAt(userIdentifier: string): Promise<Date | null> {
  const [row] = await db
    .select({ firstAt: min(enduserEvents.createdAt) })
    .from(enduserEvents)
    .where(eq(enduserEvents.userIdentifier, userIdentifier));
  return row?.firstAt ?? null;
}

/** Anchor "account age" for new-user targeting: earliest of first telemetry and `startDate`. */
function newUserAnchorDate(endUser: EndUserRow, firstEventAt: Date | null): Date {
  const start = endUser.startDate;
  if (!firstEventAt) return start;
  return firstEventAt.getTime() < start.getTime() ? firstEventAt : start;
}

function campaignMatchesPlatformIds(
  campaign: CampaignSelectRow,
  matchingPlatformIds: Set<string>
): boolean {
  const ids = campaign.platformIds ?? [];
  if (ids.length === 0) return true;
  return ids.some((id) => matchingPlatformIds.has(id));
}

async function loadPlatformsList(): Promise<{ id: string; domain: string }[]> {
  const cached = await getCachedPlatformList();
  if (cached) return cached;
  const fresh = await fetchExtensionPlatformsList();
  await setCachedPlatformList(fresh);
  return fresh;
}

async function buildQualifyContext(params: {
  endUser: EndUserRow;
  request: NextRequest;
  campaignIds: string[];
}): Promise<ExtensionCampaignQualifyContext> {
  const { endUser, request, campaignIds } = params;
  const userIdentifier = userIdentifierForEndUser(endUser);
  const [firstEventAt, frequencyCountsRecord] = await Promise.all([
    fetchFirstEventCreatedAt(userIdentifier),
    fetchFrequencyCountsForEndUser(userIdentifier, campaignIds),
  ]);

  const viewCountByCampaignId = new Map<string, number>();
  for (const [id, n] of Object.entries(frequencyCountsRecord)) {
    viewCountByCampaignId.set(id, n);
  }

  const now = new Date();
  const anchor = newUserAnchorDate(endUser, firstEventAt);

  return {
    now,
    currentMinutes: currentLocalMinutesSinceMidnight(now),
    isNewUser: isExtensionUserNewForAdBlock(anchor),
    endUserGeoCountry: endUserGeoCountryFromRequest(request, endUser),
    viewCountByCampaignId,
  };
}

export async function runServeAds(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain: string;
  userAgent: string | null;
}): Promise<{ ads: ExtensionLiveCampaignPayload[] }> {
  void params.userAgent;
  const now = new Date();
  const [rows, platforms] = await Promise.all([
    fetchActiveServeAdsCampaignRowsForExtension(now),
    loadPlatformsList(),
  ]);

  const normalizedVisit = normalizeDomainForMatch(params.domain);
  const matchingPlatformIds = platformIdSetForNormalizedDomain(normalizedVisit, platforms);

  const domainFiltered = rows.filter((c) => campaignMatchesPlatformIds(c, matchingPlatformIds));

  if (domainFiltered.length === 0) {
    return { ads: [] };
  }

  const ctx = await buildQualifyContext({
    endUser: params.endUser,
    request: params.request,
    campaignIds: domainFiltered.map((c) => c.id),
  });

  const rules = domainFiltered.map(campaignSelectRowToRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = domainFiltered.filter((c) => qualifiedIds.has(c.id));

  const ads = await hydrateCampaignPayloads(qualifiedRows);
  return { ads };
}

export type ServeRedirectItem = {
  campaignId: string;
  domain_regex: string;
  target_url: string;
  date_till: string | null;
  count: number;
};

export async function runServeRedirects(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain?: string;
}): Promise<{ redirects: ServeRedirectItem[] }> {
  const now = new Date();
  const [rows, platforms] = await Promise.all([
    fetchActiveRedirectCampaignRowsForExtension(now),
    params.domain ? loadPlatformsList() : Promise.resolve([] as { id: string; domain: string }[]),
  ]);

  let domainFiltered = rows;
  if (params.domain) {
    const normalizedVisit = normalizeDomainForMatch(params.domain);
    const matchingPlatformIds = platformIdSetForNormalizedDomain(normalizedVisit, platforms);
    domainFiltered = rows.filter((c) => campaignMatchesPlatformIds(c, matchingPlatformIds));
  }

  if (domainFiltered.length === 0) {
    return { redirects: [] };
  }

  const ctx = await buildQualifyContext({
    endUser: params.endUser,
    request: params.request,
    campaignIds: domainFiltered.map((c) => c.id),
  });

  const rules = domainFiltered.map(campaignSelectRowToRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = domainFiltered.filter((c) => qualifiedIds.has(c.id));

  const hydrated = await hydrateCampaignPayloads(qualifiedRows);

  const redirects: ServeRedirectItem[] = [];
  for (const c of hydrated) {
    const r = c.redirect;
    if (!r) continue;
    redirects.push({
      campaignId: c.id,
      domain_regex: redirectSourceToHostnameRegex(r.sourceDomain, r.includeSubdomains),
      target_url: r.destinationUrl,
      date_till: c.endDate,
      count: ctx.viewCountByCampaignId.get(c.id) ?? 0,
    });
  }

  return { redirects };
}
