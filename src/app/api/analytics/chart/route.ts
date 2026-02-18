import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaignLogs } from '@/db/schema';
import { and, gte, lte } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';
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

    const logs = await db
      .select({
        type: campaignLogs.type,
        createdAt: campaignLogs.createdAt,
      })
      .from(campaignLogs)
      .where(
        and(
          gte(campaignLogs.createdAt, start),
          lte(campaignLogs.createdAt, end)
        )
      );

    const dataByDate = new Map<string, { ad: number; notification: number }>();

    for (const log of logs) {
      const dateStr = new Date(log.createdAt).toISOString().slice(0, 10);
      const existing = dataByDate.get(dateStr) ?? { ad: 0, notification: 0 };
      if (log.type === 'ad' || log.type === 'popup') {
        existing.ad += 1;
      } else {
        existing.notification += 1;
      }
      dataByDate.set(dateStr, existing);
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
