import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { normalizeMemberIds } from '@/lib/target-list-api-body';

export const dynamic = 'force-dynamic';

const MAX_BATCH = 500;

export async function POST(request: NextRequest) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (s.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userIds = normalizeMemberIds((body as Record<string, unknown>).userIds);
    if (userIds === null) {
      return NextResponse.json({ error: 'userIds must be an array of UUID strings' }, { status: 400 });
    }
    if (userIds.length === 0) {
      return NextResponse.json({ error: 'userIds must not be empty' }, { status: 400 });
    }
    if (userIds.length > MAX_BATCH) {
      return NextResponse.json({ error: `At most ${MAX_BATCH} users per request` }, { status: 400 });
    }

    const deleted = await db
      .delete(endUsers)
      .where(inArray(endUsers.id, userIds))
      .returning({ id: endUsers.id });

    const deletedIds = deleted.map((r) => r.id);
    return NextResponse.json({
      ok: true,
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (e) {
    console.error('[api/end-users/bulk-delete POST]', e);
    return NextResponse.json({ error: 'Failed to delete users' }, { status: 500 });
  }
}
