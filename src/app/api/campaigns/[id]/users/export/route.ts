import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { endUsers, enduserEvents } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { getAccessibleCampaignById } from '@/lib/campaign-access';
import { getSessionWithRole } from '@/lib/dal';
import { utf8CsvDownloadResponse } from '@/lib/admin-csv-response';
import { escapeCsvCell } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Hard cap so a rogue export can't try to stream millions of rows into memory. */
const EXPORT_MAX_ROWS = 50_000;

export async function GET(
  _request: NextRequest,
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
      .limit(EXPORT_MAX_ROWS);

    const header = [
      'user_identifier',
      'end_user_id',
      'email',
      'plan',
      'country',
      'banned',
      'event_count',
      'last_seen_at',
    ].join(',');

    const lines = [header];
    for (const r of rows) {
      lines.push(
        [
          escapeCsvCell(r.userIdentifier ?? ''),
          escapeCsvCell(r.endUserUuid ?? ''),
          escapeCsvCell(r.email ?? ''),
          escapeCsvCell(r.plan ?? ''),
          escapeCsvCell(r.country ?? ''),
          r.banned == null ? '' : r.banned ? 'true' : 'false',
          String(Number(r.eventCount) || 0),
          r.lastSeenAt
            ? new Date(r.lastSeenAt as unknown as string).toISOString()
            : '',
        ].join(',')
      );
    }

    return utf8CsvDownloadResponse(lines, `campaign-${id}-users`);
  } catch (error) {
    console.error('Error exporting campaign users:', error);
    return NextResponse.json(
      { error: 'Failed to export campaign users' },
      { status: 500 }
    );
  }
}
