import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents } from '@/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getAccessibleCampaignById } from '@/lib/campaign-access';
import { getSessionWithRole } from '@/lib/dal';
import { getStartDate, fillMissingDays } from '@/lib/date-range';

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

    const start = getStartDate(rangeParam, RANGE_DAYS, 7);
    const end = new Date();

    const utcDay = sql`( ${enduserEvents.createdAt} AT TIME ZONE 'UTC' )::date`;

    const rows = await db
      .select({
        dateStr: sql<string>`${utcDay}::text`,
        served: sql<number>`count(*)::int`,
      })
      .from(enduserEvents)
      .where(
        and(
          eq(enduserEvents.campaignId, id),
          gte(enduserEvents.createdAt, start),
          lte(enduserEvents.createdAt, end)
        )
      )
      .groupBy(utcDay);

    const dataByDate = new Map<string, number>();
    for (const row of rows) {
      dataByDate.set(row.dateStr, Number(row.served));
    }

    const chartData = fillMissingDays(start, end, (dateStr) => ({
      served: dataByDate.get(dateStr) ?? 0,
    }));

    return NextResponse.json(chartData);
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign analytics' },
      { status: 500 }
    );
  }
}
