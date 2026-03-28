import 'server-only';

import { database as db } from '@/db';
import { campaigns, enduserEvents } from '@/db/schema';
import { and, eq, gte, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
import { endEventsOwnedCampaignJoin } from '@/lib/events-dashboard';
import { fillMissingDays, getStartDate } from '@/lib/date-range';

export type EndUserAnalyticsRange = '7d' | '30d' | '90d';

export const END_USER_ANALYTICS_RANGE_DAYS: Record<EndUserAnalyticsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export type EndUserEventSummary = {
  total: number;
  visit: number;
  ad: number;
  popup: number;
  notification: number;
  redirect: number;
  request: number;
  served: number;
};

export type EndUserDailySeriesRow = {
  date: string;
  visit: number;
  ad: number;
  popup: number;
  notification: number;
  redirect: number;
  request: number;
};

export type EndUserDomainRow = {
  domain: string;
  visits: number;
  serves: number;
};

function endUserTimeWindow(endUserId: string, start: Date, end: Date): SQL {
  return and(
    eq(enduserEvents.endUserId, endUserId.trim()),
    gte(enduserEvents.createdAt, start),
    lte(enduserEvents.createdAt, end)
  )!;
}

export async function getEndUserEventSummary(
  role: 'user' | 'admin',
  dashboardUserId: string,
  endUserId: string,
  start: Date,
  end: Date
): Promise<EndUserEventSummary> {
  const window = endUserTimeWindow(endUserId, start, end);
  const base = db
    .select({
      total: sql<number>`count(*)::int`,
      visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
      popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
      notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
      request: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'request' then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);

  const scoped =
    role === 'admin'
      ? base
      : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(dashboardUserId));

  const rows = await scoped.where(window);
  const row = rows[0];
  const ad = Number(row?.ad ?? 0);
  const popup = Number(row?.popup ?? 0);
  const notification = Number(row?.notification ?? 0);
  const redirect = Number(row?.redirect ?? 0);
  return {
    total: Number(row?.total ?? 0),
    visit: Number(row?.visit ?? 0),
    ad,
    popup,
    notification,
    redirect,
    request: Number(row?.request ?? 0),
    served: ad + popup + notification + redirect,
  };
}

export async function getEndUserDailySeries(
  role: 'user' | 'admin',
  dashboardUserId: string,
  endUserId: string,
  start: Date,
  end: Date
): Promise<EndUserDailySeriesRow[]> {
  const window = endUserTimeWindow(endUserId, start, end);
  const utcDay = sql`( ${enduserEvents.createdAt} AT TIME ZONE 'UTC' )::date`;

  const base = db
    .select({
      dateStr: sql<string>`${utcDay}::text`,
      visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
      popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
      notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
      request: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'request' then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);

  const scoped =
    role === 'admin'
      ? base
      : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(dashboardUserId));

  const rows = await scoped.where(window).groupBy(utcDay);

  const byDate = new Map<string, Omit<EndUserDailySeriesRow, 'date'>>();
  for (const r of rows) {
    byDate.set(r.dateStr, {
      visit: Number(r.visit),
      ad: Number(r.ad),
      popup: Number(r.popup),
      notification: Number(r.notification),
      redirect: Number(r.redirect),
      request: Number(r.request),
    });
  }

  const filled = fillMissingDays(start, end, (dateStr) => byDate.get(dateStr) ?? {
    visit: 0,
    ad: 0,
    popup: 0,
    notification: 0,
    redirect: 0,
    request: 0,
  });

  return filled.map((d) => ({
    date: d.date,
    visit: d.visit,
    ad: d.ad,
    popup: d.popup,
    notification: d.notification,
    redirect: d.redirect,
    request: d.request,
  }));
}

export async function getEndUserTopDomains(
  role: 'user' | 'admin',
  dashboardUserId: string,
  endUserId: string,
  start: Date,
  end: Date,
  limit = 10
): Promise<EndUserDomainRow[]> {
  const window = endUserTimeWindow(endUserId, start, end);
  const domainCol = sql<string>`coalesce(nullif(trim(${enduserEvents.domain}), ''), '(unknown)')`;

  const domainWhere = and(
    window,
    isNotNull(enduserEvents.domain),
    sql`trim(${enduserEvents.domain}) <> ''`
  )!;

  const base = db
    .select({
      domain: domainCol,
      visits: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      serves: sql<number>`coalesce(sum(case when ${enduserEvents.type} in ('ad','popup','notification','redirect') then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);

  const scoped =
    role === 'admin'
      ? base
      : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(dashboardUserId));

  const rows = await scoped
    .where(domainWhere)
    .groupBy(domainCol)
    .orderBy(
      sql`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0) + coalesce(sum(case when ${enduserEvents.type} in ('ad','popup','notification','redirect') then 1 else 0 end), 0) desc`
    )
    .limit(limit);

  return rows.map((r) => ({
    domain: r.domain,
    visits: Number(r.visits),
    serves: Number(r.serves),
  }));
}

export async function getEndUserAnalyticsBundle(
  role: 'user' | 'admin',
  dashboardUserId: string,
  endUserId: string,
  range: EndUserAnalyticsRange
): Promise<{
  range: EndUserAnalyticsRange;
  start: string;
  end: string;
  summary: EndUserEventSummary;
  series: EndUserDailySeriesRow[];
  topDomains: EndUserDomainRow[];
}> {
  const start = getStartDate(range, END_USER_ANALYTICS_RANGE_DAYS, 90);
  const end = new Date();

  const [summary, series, topDomains] = await Promise.all([
    getEndUserEventSummary(role, dashboardUserId, endUserId, start, end),
    getEndUserDailySeries(role, dashboardUserId, endUserId, start, end),
    getEndUserTopDomains(role, dashboardUserId, endUserId, start, end, 10),
  ]);

  return {
    range,
    start: start.toISOString(),
    end: end.toISOString(),
    summary,
    series,
    topDomains,
  };
}
