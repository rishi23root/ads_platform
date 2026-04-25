import 'server-only';

import { database as db } from '@/db';
import { endUsers, enduserEvents } from '@/db/schema';
import { and, eq, gte, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
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
  served: number;
};

export type EndUserDailySeriesRow = {
  date: string;
  visit: number;
  ad: number;
  popup: number;
  notification: number;
  redirect: number;
};

export type EndUserDomainRow = {
  domain: string;
  visits: number;
  serves: number;
};

function endUserTimeWindow(userIdentifier: string, start: Date, end: Date): SQL {
  return and(
    eq(enduserEvents.userIdentifier, userIdentifier.trim()),
    gte(enduserEvents.createdAt, start),
    lte(enduserEvents.createdAt, end)
  )!;
}

export async function getEndUserEventSummary(
  role: 'user' | 'admin',
  _dashboardUserId: string,
  userIdentifier: string,
  start: Date,
  end: Date
): Promise<EndUserEventSummary> {
  const window = endUserTimeWindow(userIdentifier, start, end);
  if (role !== 'admin') {
    return {
      total: 0,
      visit: 0,
      ad: 0,
      popup: 0,
      notification: 0,
      redirect: 0,
      served: 0,
    };
  }

  const base = db
    .select({
      total: sql<number>`count(*)::int`,
      visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
      popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
      notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);

  const rows = await base.where(window);
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
    served: ad + popup + notification + redirect,
  };
}

export async function getEndUserDailySeries(
  role: 'user' | 'admin',
  _dashboardUserId: string,
  userIdentifier: string,
  start: Date,
  end: Date
): Promise<EndUserDailySeriesRow[]> {
  if (role !== 'admin') {
    return [];
  }
  const window = endUserTimeWindow(userIdentifier, start, end);
  const utcDay = sql`( ${enduserEvents.createdAt} AT TIME ZONE 'UTC' )::date`;

  const base = db
    .select({
      dateStr: sql<string>`${utcDay}::text`,
      visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
      popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
      notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);

  const rows = await base.where(window).groupBy(utcDay);

  const byDate = new Map<string, Omit<EndUserDailySeriesRow, 'date'>>();
  for (const r of rows) {
    byDate.set(r.dateStr, {
      visit: Number(r.visit),
      ad: Number(r.ad),
      popup: Number(r.popup),
      notification: Number(r.notification),
      redirect: Number(r.redirect),
    });
  }

  const filled = fillMissingDays(start, end, (dateStr) => byDate.get(dateStr) ?? {
    visit: 0,
    ad: 0,
    popup: 0,
    notification: 0,
    redirect: 0,
  });

  return filled.map((d) => ({
    date: d.date,
    visit: d.visit,
    ad: d.ad,
    popup: d.popup,
    notification: d.notification,
    redirect: d.redirect,
  }));
}

export async function getEndUserTopDomains(
  role: 'user' | 'admin',
  _dashboardUserId: string,
  userIdentifier: string,
  start: Date,
  end: Date,
  limit = 10
): Promise<EndUserDomainRow[]> {
  if (role !== 'admin') {
    return [];
  }
  const window = endUserTimeWindow(userIdentifier, start, end);
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

  const rows = await base
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
  endUserUuid: string,
  range: EndUserAnalyticsRange
): Promise<{
  range: EndUserAnalyticsRange;
  start: string;
  end: string;
  summary: EndUserEventSummary;
  series: EndUserDailySeriesRow[];
  topDomains: EndUserDomainRow[];
}> {
  const [identRow] = await db
    .select({ identifier: endUsers.identifier })
    .from(endUsers)
    .where(eq(endUsers.id, endUserUuid))
    .limit(1);
  const userIdentifier = identRow?.identifier ?? '';

  const start = getStartDate(range, END_USER_ANALYTICS_RANGE_DAYS, 7);
  const end = new Date();

  const emptySummary: EndUserEventSummary = {
    total: 0,
    visit: 0,
    ad: 0,
    popup: 0,
    notification: 0,
    redirect: 0,
    served: 0,
  };

  if (!userIdentifier) {
    return {
      range,
      start: start.toISOString(),
      end: end.toISOString(),
      summary: emptySummary,
      series: [],
      topDomains: [],
    };
  }

  // Run series and topDomains in parallel. Summary totals are derived from the series
  // rows in JS — avoids a third full table scan over the same user+window data.
  const [series, topDomains] = await Promise.all([
    getEndUserDailySeries(role, dashboardUserId, userIdentifier, start, end),
    getEndUserTopDomains(role, dashboardUserId, userIdentifier, start, end, 10),
  ]);

  const summary: EndUserEventSummary = { total: 0, visit: 0, ad: 0, popup: 0, notification: 0, redirect: 0, served: 0 };
  for (const row of series) {
    summary.visit += row.visit;
    summary.ad += row.ad;
    summary.popup += row.popup;
    summary.notification += row.notification;
    summary.redirect += row.redirect;
  }
  summary.served = summary.ad + summary.popup + summary.notification + summary.redirect;
  summary.total = summary.visit + summary.served;

  return {
    range,
    start: start.toISOString(),
    end: end.toISOString(),
    summary,
    series,
    topDomains,
  };
}
