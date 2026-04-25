import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents } from '@/db/schema';
import { and, eq, gte, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';
import { DASHBOARD_SERVED_EVENT_TYPES, eventsAccessScopeForRole } from '@/lib/events-dashboard';
import { getStartDate, fillMissingDays } from '@/lib/date-range';
import type { ExtensionEventChartRow } from '@/lib/extension-events-chart';

export const dynamic = 'force-dynamic';

export type ChartDataPoint = ExtensionEventChartRow;

type RangeKey = '7d' | '30d' | '90d';

const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export async function GET(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '7d') as RangeKey;
    const validRange: RangeKey[] = ['7d', '30d', '90d'];
    const rangeParam = validRange.includes(range) ? range : '7d';

    const start = getStartDate(rangeParam, RANGE_DAYS, 7);
    const end = new Date();

    const utcDay = sql`( ${enduserEvents.createdAt} AT TIME ZONE 'UTC' )::date`;

    /** Served events must be campaign-linked; visits often have no `campaign_id` but still appear in the global event log. */
    const scopeWhere = and(
      gte(enduserEvents.createdAt, start),
      lte(enduserEvents.createdAt, end),
      or(
        and(
          isNotNull(enduserEvents.campaignId),
          inArray(enduserEvents.type, [...DASHBOARD_SERVED_EVENT_TYPES])
        ),
        eq(enduserEvents.type, 'visit')
      )
    );
    const access = eventsAccessScopeForRole(
      sessionWithRole.role,
      sessionWithRole.user.id
    );
    const chartWhere = access ? and(scopeWhere, access) : scopeWhere;

    const base = db
      .select({
        dateStr: sql<string>`${utcDay}::text`,
        ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
        popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
        notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
        redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
        visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      })
      .from(enduserEvents);

    const rows = await base.where(chartWhere).groupBy(utcDay);

    const dataByDate = new Map<
      string,
      { ad: number; popup: number; notification: number; redirect: number; visit: number }
    >();
    for (const row of rows) {
      dataByDate.set(row.dateStr, {
        ad: Number(row.ad),
        popup: Number(row.popup),
        notification: Number(row.notification),
        redirect: Number(row.redirect),
        visit: Number(row.visit),
      });
    }

    const chartData = fillMissingDays(start, end, (dateStr) =>
      dataByDate.get(dateStr) ?? { ad: 0, popup: 0, notification: 0, redirect: 0, visit: 0 }
    ) as ChartDataPoint[];

    return NextResponse.json(chartData);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
