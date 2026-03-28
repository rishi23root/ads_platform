import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/dal';
import {
  END_USER_ANALYTICS_RANGE_DAYS,
  type EndUserAnalyticsRange,
  getEndUserAnalyticsBundle,
} from '@/lib/end-user-analytics';
import { isValidEndUserUuid } from '@/lib/end-user-id';

export const dynamic = 'force-dynamic';

const VALID_RANGE: EndUserAnalyticsRange[] = ['7d', '30d', '90d'];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!isValidEndUserUuid(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const rangeRaw = (searchParams.get('range') ?? '30d') as EndUserAnalyticsRange;
    const range = VALID_RANGE.includes(rangeRaw) ? rangeRaw : '30d';

    const payload = await getEndUserAnalyticsBundle(
      sessionWithRole.role,
      sessionWithRole.user.id,
      id,
      range
    );

    return NextResponse.json({
      summary: payload.summary,
      series: payload.series,
      topDomains: payload.topDomains,
      range: payload.range,
      start: payload.start,
      end: payload.end,
      rangeDays: END_USER_ANALYTICS_RANGE_DAYS[range],
    });
  } catch (error) {
    console.error('[api/end-users/[id]/analytics GET]', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
