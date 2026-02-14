import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaignLogs } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '14d' | '30d';

const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

function getStartDate(range: RangeKey): Date {
  const days = RANGE_DAYS[range] ?? 14;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function fillMissingDays(start: Date, end: Date, dataByDate: Map<string, number>): { date: string; served: number }[] {
  const result: { date: string; served: number }[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const endTime = end.getTime();

  while (current.getTime() <= endTime) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({
      date: dateStr,
      served: dataByDate.get(dateStr) ?? 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '14d') as RangeKey;
    const validRange: RangeKey[] = ['7d', '14d', '30d'];
    const rangeParam = validRange.includes(range) ? range : '14d';

    const start = getStartDate(rangeParam);
    const end = new Date();

    const logs = await db
      .select({
        createdAt: campaignLogs.createdAt,
      })
      .from(campaignLogs)
      .where(
        and(
          eq(campaignLogs.campaignId, id),
          gte(campaignLogs.createdAt, start),
          lte(campaignLogs.createdAt, end)
        )
      );

    const dataByDate = new Map<string, number>();
    for (const log of logs) {
      const dateStr = new Date(log.createdAt).toISOString().slice(0, 10);
      dataByDate.set(dateStr, (dataByDate.get(dateStr) ?? 0) + 1);
    }

    const chartData = fillMissingDays(start, end, dataByDate);

    return NextResponse.json(chartData);
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign analytics' },
      { status: 500 }
    );
  }
}
