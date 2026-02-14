import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaignLogs } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    const where = eq(campaignLogs.campaignId, id);

    const [logs, countResult] = await Promise.all([
      db
        .select({
          id: campaignLogs.id,
          visitorId: campaignLogs.visitorId,
          domain: campaignLogs.domain,
          type: campaignLogs.type,
          createdAt: campaignLogs.createdAt,
        })
        .from(campaignLogs)
        .where(where)
        .orderBy(desc(campaignLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(campaignLogs).where(where),
    ]);

    const totalCount = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      logs,
      totalCount,
      totalPages,
      page,
    });
  } catch (error) {
    console.error('Error fetching campaign logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign logs' },
      { status: 500 }
    );
  }
}
