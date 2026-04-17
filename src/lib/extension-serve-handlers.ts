import 'server-only';

import type { NextRequest } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents, type EndUserRow } from '@/db/schema';
import {
  currentLocalMinutesSinceMidnight,
  filterQualifyingExtensionCampaigns,
  isExtensionUserNewForAdBlock,
  type ExtensionCampaignQualifyContext,
} from '@/lib/extension-ad-block-qualify';
import { campaignSelectRowToRuleFields } from '@/lib/extension-campaign-rule-mapper';
import type {
  CampaignSelectRow,
  ExtensionServeCreativePayload,
  ExtensionServeCreativesResult,
} from '@/lib/extension-live-init';
import {
  buildServeCreativeBuckets,
  fetchActiveCampaignRowsForExtension,
  fetchExtensionPlatformsList,
  fetchFirstEventCreatedAt,
  fetchFrequencyCountsForEndUser,
  newUserAnchorDate,
} from '@/lib/extension-live-init';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';
import { normalizeDomainForMatch, platformIdSetForNormalizedDomain } from '@/lib/domain-utils';
import { countryCodeFromRequestHeaders } from '@/lib/enduser-request-country';
import { getCachedPlatformList, setCachedPlatformList } from '@/lib/redis';

export type { ExtensionServeCreativesResult, ExtensionServeCreativePayload };

/**
 * Inserts one `enduser_events` row per creative returned from `POST /api/extension/serve`
 * (`ad`, `popup`, or `notification`), so the dashboard reflects serves even when the client
 * does not batch separate impression calls.
 */
export async function logExtensionServeEvents(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain: string;
  ads: ExtensionServeCreativePayload[];
  popups: ExtensionServeCreativePayload[];
  notifications: ExtensionServeCreativePayload[];
}): Promise<void> {
  const total =
    params.ads.length + params.popups.length + params.notifications.length;
  if (total === 0) return;

  const userIdentifier = userIdentifierForEndUser(params.endUser);
  const country =
    countryCodeFromRequestHeaders(params.request) ?? params.endUser.country ?? null;
  const userAgent = params.request.headers.get('user-agent')?.slice(0, 2000) ?? null;

  const rows: (typeof enduserEvents.$inferInsert)[] = [];
  for (const p of params.ads) {
    rows.push({
      userIdentifier,
      campaignId: p.id,
      domain: params.domain,
      type: 'ad',
      country,
      userAgent,
    });
  }
  for (const p of params.popups) {
    rows.push({
      userIdentifier,
      campaignId: p.id,
      domain: params.domain,
      type: 'popup',
      country,
      userAgent,
    });
  }
  for (const p of params.notifications) {
    rows.push({
      userIdentifier,
      campaignId: p.id,
      domain: params.domain,
      type: 'notification',
      country,
      userAgent,
    });
  }
  await db.insert(enduserEvents).values(rows);
}

function endUserGeoCountryFromRequest(request: NextRequest, endUser: EndUserRow): string | null {
  const fromHeaders = countryCodeFromRequestHeaders(request);
  if (fromHeaders) return fromHeaders;
  const fromRow = endUser.country?.trim().toUpperCase();
  return fromRow && fromRow.length === 2 ? fromRow : null;
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

export type ExtensionServeCreativeType = 'ads' | 'popup' | 'notification';

export async function runServeCreatives(params: {
  endUser: EndUserRow;
  request: NextRequest;
  domain: string;
  campaignTypes: ExtensionServeCreativeType[];
}): Promise<ExtensionServeCreativesResult> {
  const now = new Date();
  const [rows, platforms] = await Promise.all([
    fetchActiveCampaignRowsForExtension(now),
    loadPlatformsList(),
  ]);

  const typeSet = new Set(params.campaignTypes);
  const typeFiltered = rows.filter((c) => typeSet.has(c.campaignType as ExtensionServeCreativeType));

  const normalizedVisit = normalizeDomainForMatch(params.domain);
  const matchingPlatformIds = platformIdSetForNormalizedDomain(normalizedVisit, platforms);

  const domainFiltered = typeFiltered.filter((c) => campaignMatchesPlatformIds(c, matchingPlatformIds));

  if (domainFiltered.length === 0) {
    return { ads: [], popups: [], notifications: [] };
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

  return buildServeCreativeBuckets(qualifiedRows);
}
