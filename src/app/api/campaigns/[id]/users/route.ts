import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { endUsers, enduserEvents } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { getAccessibleCampaignById } from '@/lib/campaign-access';
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
    const accessible = await getAccessibleCampaignById(sessionWithRole, id);
    if (!accessible) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    // One row per distinct user_identifier for this campaign, joined to
    // end_users when we have a registered row for them. `count(*) over()`
    // after GROUP BY gives the number of groups = total distinct users.
    const rows = await db
      .select({
        userIdentifier: enduserEvents.userIdentifier,
        endUserUuid: endUsers.id,
        email: endUsers.email,
        plan: endUsers.plan,
        country: endUsers.country,
        banned: endUsers.banned,
        eventCount: sql<number>`count(*)::int`,
        lastSeenAt: sql<string>`max(${enduserEvents.createdAt})`,
        totalCount: sql<number>`count(*) over ()::int`,
      })
      .from(enduserEvents)
      .leftJoin(endUsers, eq(endUsers.identifier, enduserEvents.userIdentifier))
      .where(eq(enduserEvents.campaignId, id))
      .groupBy(
        enduserEvents.userIdentifier,
        endUsers.id,
        endUsers.email,
        endUsers.plan,
        endUsers.country,
        endUsers.banned
      )
      .orderBy(desc(sql`count(*)`), desc(sql`max(${enduserEvents.createdAt})`))
      .limit(pageSize)
      .offset(offset);

    const totalCount = rows.length > 0 ? Number(rows[0].totalCount) : 0;
    const users = rows.map((row) => {
      const { totalCount: strip, ...rest } = row;
      void strip;
      return {
        ...rest,
        eventCount: Number(rest.eventCount),
        lastSeenAt: rest.lastSeenAt
          ? new Date(rest.lastSeenAt as unknown as string).toISOString()
          : null,
      };
    });
    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      users,
      totalCount,
      totalPages,
      page,
    });
  } catch (error) {
    console.error('Error fetching campaign users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign users' },
      { status: 500 }
    );
  }
}
