import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { requestLogs } from '@/db/schema';
import { and, gte, lte } from 'drizzle-orm';

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

function getStartDate(range: RangeKey): Date {
  const days = RANGE_DAYS[range] ?? 90;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function fillMissingDays(
  start: Date,
  end: Date,
  dataByDate: Map<string, { ad: number; notification: number }>
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const endTime = end.getTime();

  while (current.getTime() <= endTime) {
    const dateStr = current.toISOString().slice(0, 10);
    const point = dataByDate.get(dateStr) ?? { ad: 0, notification: 0 };
    result.push({
      date: dateStr,
      ad: point.ad,
      notification: point.notification,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '90d') as RangeKey;
    const validRange: RangeKey[] = ['7d', '30d', '90d'];
    const rangeParam = validRange.includes(range) ? range : '90d';

    const start = getStartDate(rangeParam);
    const end = new Date();

    const logs = await db
      .select({
        requestType: requestLogs.requestType,
        createdAt: requestLogs.createdAt,
      })
      .from(requestLogs)
      .where(
        and(
          gte(requestLogs.createdAt, start),
          lte(requestLogs.createdAt, end)
        )
      );

    const dataByDate = new Map<string, { ad: number; notification: number }>();

    for (const log of logs) {
      const dateStr = new Date(log.createdAt).toISOString().slice(0, 10);
      const existing = dataByDate.get(dateStr) ?? { ad: 0, notification: 0 };
      if (log.requestType === 'ad') {
        existing.ad += 1;
      } else {
        existing.notification += 1;
      }
      dataByDate.set(dateStr, existing);
    }

    const chartData = fillMissingDays(start, end, dataByDate);

    return NextResponse.json(chartData);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
