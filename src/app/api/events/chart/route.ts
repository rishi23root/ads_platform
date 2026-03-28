import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaigns, enduserEvents } from '@/db/schema';
import { and, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';
import {
  DASHBOARD_SERVED_EVENT_TYPES,
  endEventsOwnedCampaignJoin,
} from '@/lib/events-dashboard';
import { getStartDate, fillMissingDays } from '@/lib/date-range';

export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d';

const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export interface ChartDataPoint {
  date: string;
  ad: number;
  notification: number;
}

export async function GET(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '90d') as RangeKey;
    const validRange: RangeKey[] = ['7d', '30d', '90d'];
    const rangeParam = validRange.includes(range) ? range : '90d';

    const start = getStartDate(rangeParam, RANGE_DAYS, 90);
    const end = new Date();

    const utcDay = sql`( ${enduserEvents.createdAt} AT TIME ZONE 'UTC' )::date`;

    const scopeWhere = and(
      isNotNull(enduserEvents.campaignId),
      inArray(enduserEvents.type, DASHBOARD_SERVED_EVENT_TYPES),
      gte(enduserEvents.createdAt, start),
      lte(enduserEvents.createdAt, end)
    );

    const base = db
      .select({
        dateStr: sql<string>`${utcDay}::text`,
        ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} in ('ad', 'popup') then 1 else 0 end), 0)::int`,
        notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      })
      .from(enduserEvents);

    const scoped =
      sessionWithRole.role === 'admin'
        ? base
        : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(sessionWithRole.user.id));

    const rows = await scoped.where(scopeWhere).groupBy(utcDay);

    const dataByDate = new Map<string, { ad: number; notification: number }>();
    for (const row of rows) {
      dataByDate.set(row.dateStr, {
        ad: Number(row.ad),
        notification: Number(row.notification),
      });
    }

    const chartData = fillMissingDays(start, end, (dateStr) =>
      dataByDate.get(dateStr) ?? { ad: 0, notification: 0 }
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
