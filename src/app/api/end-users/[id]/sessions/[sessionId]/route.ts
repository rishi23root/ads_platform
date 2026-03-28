import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, enduserSessions } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: endUserId, sessionId } = await context.params;

    const [user] = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.id, endUserId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const removed = await db
      .delete(enduserSessions)
      .where(and(eq(enduserSessions.id, sessionId), eq(enduserSessions.endUserId, endUserId)))
      .returning({ id: enduserSessions.id });

    if (removed.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/end-users/[id]/sessions/[sessionId] DELETE]', error);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
