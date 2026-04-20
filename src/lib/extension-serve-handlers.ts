import 'server-only';

import type { NextRequest } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents, type EndUserRow } from '@/db/schema';
import { filterQualifyingExtensionCampaigns } from '@/lib/extension-ad-block-qualify';
import { campaignSelectRowToRuleFields } from '@/lib/extension-campaign-rule-mapper';
import type {
  CampaignSelectRow,
  ExtensionServeCreativePayload,
  ExtensionServeCreativesResult,
} from '@/lib/extension-live-init';
import {
  buildExtensionCampaignQualifyContext,
  buildServeCreativeBuckets,
  fetchActiveCampaignRowsForExtension,
  fetchExtensionPlatformsList,
} from '@/lib/extension-live-init';
import { countryCodeFromRequestHeaders } from '@/lib/enduser-request-country';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';
import { normalizeDomainForMatch, platformIdSetForNormalizedDomain } from '@/lib/domain-utils';
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
  const buckets: Array<{
    type: 'ad' | 'popup' | 'notification';
    items: ExtensionServeCreativePayload[];
  }> = [
    { type: 'ad', items: params.ads },
    { type: 'popup', items: params.popups },
    { type: 'notification', items: params.notifications },
  ];
  for (const { type, items } of buckets) {
    for (const p of items) {
      rows.push({
        userIdentifier,
        campaignId: p.id,
        domain: params.domain,
        type,
        country,
        userAgent,
      });
    }
  }
  await db.insert(enduserEvents).values(rows);
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

  const targetListIds = Array.from(
    new Set(domainFiltered.map((c) => c.targetListId).filter((x): x is string => Boolean(x)))
  );
  const ctx = await buildExtensionCampaignQualifyContext(
    params.endUser,
    domainFiltered.map((c) => c.id),
    targetListIds,
    params.request
  );

  const rules = domainFiltered.map(campaignSelectRowToRuleFields);
  const qualifiedRules = filterQualifyingExtensionCampaigns(rules, ctx);
  const qualifiedIds = new Set(qualifiedRules.map((r) => r.id));
  const qualifiedRows = domainFiltered.filter((c) => qualifiedIds.has(c.id));

  return buildServeCreativeBuckets(qualifiedRows);
}
