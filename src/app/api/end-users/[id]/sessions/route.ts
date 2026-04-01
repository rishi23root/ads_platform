import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, enduserSessions } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: endUserId } = await context.params;
    const [user] = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.id, endUserId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const now = new Date();
    const rows = await db
      .select({
        id: enduserSessions.id,
        createdAt: enduserSessions.createdAt,
        expiresAt: enduserSessions.expiresAt,
        userAgent: enduserSessions.userAgent,
        ipAddress: enduserSessions.ipAddress,
      })
      .from(enduserSessions)
      .where(eq(enduserSessions.endUserId, endUserId))
      .orderBy(desc(enduserSessions.createdAt));

    const sessions = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      active: r.expiresAt > now,
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[api/end-users/[id]/sessions GET]', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: endUserId } = await context.params;
    const [user] = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.id, endUserId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const removed = await db
      .delete(enduserSessions)
      .where(eq(enduserSessions.endUserId, endUserId))
      .returning({ id: enduserSessions.id });

    return NextResponse.json({ ok: true, removed: removed.length });
  } catch (error) {
    console.error('[api/end-users/[id]/sessions DELETE]', error);
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 });
  }
}
