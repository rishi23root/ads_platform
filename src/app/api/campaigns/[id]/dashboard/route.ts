import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  enduserEvents,
  campaigns,
  platforms,
  ads,
  notifications,
  redirects,
} from '@/db/schema';
import { and, eq, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { getAccessibleCampaignById } from '@/lib/campaign-access';
import { getSessionWithRole } from '@/lib/dal';
import { getDateRange, fillMissingDays } from '@/lib/date-range';
import { extractRootDomain, getCanonicalDisplayDomain } from '@/lib/domain-utils';

export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '14d' | '30d';

const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const accessible = await getAccessibleCampaignById(sessionWithRole, id);
    if (!accessible) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '7d') as RangeKey;
    const validRange: RangeKey[] = ['7d', '14d', '30d'];
    const rangeParam = validRange.includes(range) ? range : '7d';

    const { start, end, prevStart, prevEnd } = getDateRange(rangeParam, RANGE_DAYS, 7);

    const utcDay = sql`( ${enduserEvents.createdAt} AT TIME ZONE 'UTC' )::date`;

    const periodCurrent = and(
      eq(enduserEvents.campaignId, id),
      gte(enduserEvents.createdAt, start),
      lte(enduserEvents.createdAt, end)
    );
    const periodPrev = and(
      eq(enduserEvents.campaignId, id),
      gte(enduserEvents.createdAt, prevStart),
      lte(enduserEvents.createdAt, prevEnd)
    );

    const [
      kpiCurRow,
      kpiPrevRow,
      chartAggRows,
      campaignLinkRow,
      topDomainsRaw,
      countryDistribution,
    ] = await Promise.all([
      db
        .select({
          impressions: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${enduserEvents.endUserId})::int`,
        })
        .from(enduserEvents)
        .where(periodCurrent),
      db
        .select({
          impressions: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${enduserEvents.endUserId})::int`,
        })
        .from(enduserEvents)
        .where(periodPrev),
      db
        .select({
          dateStr: sql<string>`${utcDay}::text`,
          impressions: sql<number>`count(*)::int`,
          users: sql<number>`count(distinct ${enduserEvents.endUserId})::int`,
        })
        .from(enduserEvents)
        .where(periodCurrent)
        .groupBy(utcDay),
      db
        .select({
          adId: campaigns.adId,
          notificationId: campaigns.notificationId,
          redirectId: campaigns.redirectId,
          platformIds: campaigns.platformIds,
          countryCodes: campaigns.countryCodes,
        })
        .from(campaigns)
        .where(eq(campaigns.id, id))
        .limit(1),
      db
        .select({ domain: enduserEvents.domain, count: sql<number>`count(*)` })
        .from(enduserEvents)
        .where(periodCurrent)
        .groupBy(enduserEvents.domain)
        .orderBy(desc(sql`count(*)`))
        .limit(30),
      db
        .select({ country: enduserEvents.country, count: sql<number>`count(*)` })
        .from(enduserEvents)
        .where(periodCurrent)
        .groupBy(enduserEvents.country)
        .orderBy(desc(sql`count(*)`))
        .limit(15),
    ]);

    const impressions = Number(kpiCurRow[0]?.impressions ?? 0);
    const uniqueEndUsers = Number(kpiCurRow[0]?.uniqueUsers ?? 0);
    const prevImpressions = Number(kpiPrevRow[0]?.impressions ?? 0);
    const prevUniqueEndUsers = Number(kpiPrevRow[0]?.uniqueUsers ?? 0);

    const impressionsChange =
      prevImpressions > 0 ? ((impressions - prevImpressions) / prevImpressions) * 100 : null;
    const usersChange =
      prevUniqueEndUsers > 0
        ? ((uniqueEndUsers - prevUniqueEndUsers) / prevUniqueEndUsers) * 100
        : null;

    const impressionsByDate = new Map<string, number>();
    const usersByDate = new Map<string, number>();
    for (const row of chartAggRows) {
      impressionsByDate.set(row.dateStr, Number(row.impressions));
      usersByDate.set(row.dateStr, Number(row.users));
    }
    const chartData = fillMissingDays(start, end, (dateStr) => ({
      impressions: impressionsByDate.get(dateStr) ?? 0,
      users: usersByDate.get(dateStr) ?? 0,
    }));

    // Merge domains by root (e.g. www.instagram.com + instagram.com → instagram.com)
    const mergedByRoot = new Map<string, { displayDomain: string; count: number }>();
    for (const row of topDomainsRaw) {
      const domain = (row.domain ?? '').trim();
      if (!domain) continue;
      const root = extractRootDomain(domain);
      const display = getCanonicalDisplayDomain(domain);
      const count = Number(row.count);
      const existing = mergedByRoot.get(root);
      if (existing) {
        existing.count += count;
      } else {
        mergedByRoot.set(root, { displayDomain: display, count });
      }
    }
    const topDomains = Array.from(mergedByRoot.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ displayDomain, count }) => ({ domain: displayDomain, count }));

    const linkingRow = campaignLinkRow[0];
    const platformIds = linkingRow?.platformIds?.length ? [...linkingRow.platformIds] : [];
    const platformDomains =
      platformIds.length > 0
        ? (
          await db
            .select({ domain: platforms.domain })
            .from(platforms)
            .where(inArray(platforms.id, platformIds))
        ).map((p) => p.domain)
        : [];

    let linkedContent:
      | { type: 'ad'; id: string; name: string; description: string | null; imageUrl: string | null; targetUrl: string | null }
      | { type: 'notification'; id: string; title: string; message: string; ctaLink: string | null }
      | {
        type: 'redirect';
        id: string;
        name: string;
        sourceDomain: string;
        includeSubdomains: boolean;
        destinationUrl: string;
      }
      | null = null;
    const linking = linkingRow;
    if (linking?.adId) {
      const [ad] = await db
        .select({ id: ads.id, name: ads.name, description: ads.description, imageUrl: ads.imageUrl, targetUrl: ads.targetUrl })
        .from(ads)
        .where(eq(ads.id, linking.adId))
        .limit(1);
      if (ad) linkedContent = { type: 'ad', id: ad.id, name: ad.name, description: ad.description, imageUrl: ad.imageUrl, targetUrl: ad.targetUrl };
    } else if (linking?.notificationId) {
      const [n] = await db
        .select({ id: notifications.id, title: notifications.title, message: notifications.message, ctaLink: notifications.ctaLink })
        .from(notifications)
        .where(eq(notifications.id, linking.notificationId))
        .limit(1);
      if (n) linkedContent = { type: 'notification', id: n.id, title: n.title, message: n.message, ctaLink: n.ctaLink };
    } else if (linking?.redirectId) {
      const [r] = await db
        .select({
          id: redirects.id,
          name: redirects.name,
          sourceDomain: redirects.sourceDomain,
          includeSubdomains: redirects.includeSubdomains,
          destinationUrl: redirects.destinationUrl,
        })
        .from(redirects)
        .where(eq(redirects.id, linking.redirectId))
        .limit(1);
      if (r)
        linkedContent = {
          type: 'redirect',
          id: r.id,
          name: r.name,
          sourceDomain: r.sourceDomain,
          includeSubdomains: r.includeSubdomains,
          destinationUrl: r.destinationUrl,
        };
    }

    return NextResponse.json({
      kpis: {
        impressions,
        uniqueUsers: uniqueEndUsers,
        ctr: null,
        conversions: null,
        impressionsChange,
        usersChange,
      },
      chartData,
      topDomains,
      countryDistribution: countryDistribution.map((c) => ({
        country: c.country,
        count: Number(c.count),
      })),
      meta: {
        platformDomains,
        countryCodes: linkingRow?.countryCodes?.length ? [...linkingRow.countryCodes] : [],
        linkedContent,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching campaign dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign dashboard', details: message },
      { status: 500 }
    );
  }
}
