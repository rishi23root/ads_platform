import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { getAccessibleCampaignById } from '@/lib/campaign-access';
import { getSessionWithRole } from '@/lib/dal';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const EVENT_TYPES = [
  'ad',
  'notification',
  'popup',
  'request',
  'redirect',
  'visit',
] as const;

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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    const typeParam = searchParams.get('type');
    const typeOk =
      typeParam && (EVENT_TYPES as readonly string[]).includes(typeParam) ? typeParam : null;

    const whereClause = typeOk
      ? and(eq(enduserEvents.campaignId, id), eq(enduserEvents.type, typeOk as (typeof EVENT_TYPES)[number]))
      : eq(enduserEvents.campaignId, id);

    const rows = await db
      .select({
        id: enduserEvents.id,
        endUserId: enduserEvents.endUserId,
        domain: enduserEvents.domain,
        type: enduserEvents.type,
        statusCode: enduserEvents.statusCode,
        createdAt: enduserEvents.createdAt,
        country: enduserEvents.country,
        email: enduserEvents.email,
        plan: enduserEvents.plan,
        userAgent: enduserEvents.userAgent,
        totalCount: sql<number>`count(*) over ()::int`,
      })
      .from(enduserEvents)
      .where(whereClause)
      .orderBy(desc(enduserEvents.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalCount = rows.length > 0 ? Number(rows[0].totalCount) : 0;
    const logs = rows.map((row) => {
      const { totalCount: strip, ...log } = row;
      void strip;
      return log;
    });
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
