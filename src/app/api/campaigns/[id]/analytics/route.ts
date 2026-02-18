import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { visitors } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
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
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '14d') as RangeKey;
    const validRange: RangeKey[] = ['7d', '14d', '30d'];
    const rangeParam = validRange.includes(range) ? range : '14d';

    const start = getStartDate(rangeParam, RANGE_DAYS, 14);
    const end = new Date();

    const logs = await db
      .select({
        createdAt: visitors.createdAt,
      })
      .from(visitors)
      .where(
        and(
          eq(visitors.campaignId, id),
          gte(visitors.createdAt, start),
          lte(visitors.createdAt, end)
        )
      );

    const dataByDate = new Map<string, number>();
    for (const log of logs) {
      const dateStr = new Date(log.createdAt).toISOString().slice(0, 10);
      dataByDate.set(dateStr, (dataByDate.get(dateStr) ?? 0) + 1);
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
