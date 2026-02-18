import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  campaignLogs,
  campaignPlatforms,
  campaignCountries,
  campaignAd,
  campaignNotification,
  platforms,
  ads,
  notifications,
} from '@/db/schema';
import { and, eq, gte, lte, desc, sql, inArray } from 'drizzle-orm';
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
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '14d') as RangeKey;
    const validRange: RangeKey[] = ['7d', '14d', '30d'];
    const rangeParam = validRange.includes(range) ? range : '14d';

    const { start, end, prevStart, prevEnd } = getDateRange(rangeParam, RANGE_DAYS, 14);

    // Current period logs
    const [currentLogs, prevLogs, platformRows, countryRows, adRow, notifRow] = await Promise.all([
      db
        .select({ createdAt: campaignLogs.createdAt, visitorId: campaignLogs.visitorId })
        .from(campaignLogs)
        .where(
          and(
            eq(campaignLogs.campaignId, id),
            gte(campaignLogs.createdAt, start),
            lte(campaignLogs.createdAt, end)
          )
        ),
      db
        .select({ createdAt: campaignLogs.createdAt, visitorId: campaignLogs.visitorId })
        .from(campaignLogs)
        .where(
          and(
            eq(campaignLogs.campaignId, id),
            gte(campaignLogs.createdAt, prevStart),
            lte(campaignLogs.createdAt, prevEnd)
          )
        ),
      db
        .select({ platformId: campaignPlatforms.platformId })
        .from(campaignPlatforms)
        .where(eq(campaignPlatforms.campaignId, id)),
      db
        .select({ countryCode: campaignCountries.countryCode })
        .from(campaignCountries)
        .where(eq(campaignCountries.campaignId, id)),
      db
        .select({ adId: campaignAd.adId })
        .from(campaignAd)
        .where(eq(campaignAd.campaignId, id))
        .limit(1),
      db
        .select({ notificationId: campaignNotification.notificationId })
        .from(campaignNotification)
        .where(eq(campaignNotification.campaignId, id))
        .limit(1),
    ]);

    // KPIs current period
    const impressions = currentLogs.length;
    const uniqueVisitors = new Set(currentLogs.map((l) => l.visitorId)).size;

    // Previous period for comparison
    const prevImpressions = prevLogs.length;
    const prevUniqueVisitors = new Set(prevLogs.map((l) => l.visitorId)).size;

    const impressionsChange =
      prevImpressions > 0 ? ((impressions - prevImpressions) / prevImpressions) * 100 : null;
    const usersChange =
      prevUniqueVisitors > 0
        ? ((uniqueVisitors - prevUniqueVisitors) / prevUniqueVisitors) * 100
        : null;

    // Chart data
    const impressionsByDate = new Map<string, number>();
    const usersByDate = new Map<string, Set<string>>();
    for (const log of currentLogs) {
      const dateStr = new Date(log.createdAt).toISOString().slice(0, 10);
      impressionsByDate.set(dateStr, (impressionsByDate.get(dateStr) ?? 0) + 1);
      if (!usersByDate.has(dateStr)) usersByDate.set(dateStr, new Set());
      usersByDate.get(dateStr)!.add(log.visitorId);
    }
    const chartData = fillMissingDays(start, end, (dateStr) => ({
      impressions: impressionsByDate.get(dateStr) ?? 0,
      users: usersByDate.get(dateStr)?.size ?? 0,
    }));

    const topDomainsRaw = await db
      .select({ domain: campaignLogs.domain, count: sql<number>`count(*)` })
      .from(campaignLogs)
      .where(
        and(
          eq(campaignLogs.campaignId, id),
          gte(campaignLogs.createdAt, start),
          lte(campaignLogs.createdAt, end)
        )
      )
      .groupBy(campaignLogs.domain)
      .orderBy(desc(sql`count(*)`))
      .limit(30);

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

    let countryDistribution: { country: string | null; count: number }[] = [];
    try {
      countryDistribution = await db
        .select({ country: campaignLogs.country, count: sql<number>`count(*)` })
        .from(campaignLogs)
        .where(
          and(
            eq(campaignLogs.campaignId, id),
            gte(campaignLogs.createdAt, start),
            lte(campaignLogs.createdAt, end)
          )
        )
        .groupBy(campaignLogs.country)
        .orderBy(desc(sql`count(*)`))
        .limit(15);
    } catch {
      // country column may not exist if migration 0001_add_country_to_campaign_logs hasn't run
    }

    const platformIds = platformRows.map((r) => r.platformId);
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
      | null = null;
    if (adRow[0]) {
      const [ad] = await db
        .select({ id: ads.id, name: ads.name, description: ads.description, imageUrl: ads.imageUrl, targetUrl: ads.targetUrl })
        .from(ads)
        .where(eq(ads.id, adRow[0].adId))
        .limit(1);
      if (ad) linkedContent = { type: 'ad', id: ad.id, name: ad.name, description: ad.description, imageUrl: ad.imageUrl, targetUrl: ad.targetUrl };
    } else if (notifRow[0]) {
      const [n] = await db
        .select({ id: notifications.id, title: notifications.title, message: notifications.message, ctaLink: notifications.ctaLink })
        .from(notifications)
        .where(eq(notifications.id, notifRow[0].notificationId))
        .limit(1);
      if (n) linkedContent = { type: 'notification', id: n.id, title: n.title, message: n.message, ctaLink: n.ctaLink };
    }

    return NextResponse.json({
      kpis: {
        impressions,
        uniqueUsers: uniqueVisitors,
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
        countryCodes: countryRows.map((r) => r.countryCode),
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
