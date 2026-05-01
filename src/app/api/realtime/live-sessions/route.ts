import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { listLiveConnectionSessions } from '@/lib/redis';

/**
 * GET /api/realtime/live-sessions
 * Snapshot of extension `/api/extension/live` SSE sessions (pruned stale heartbeats).
 * Authenticated dashboard only — enriched with end-user email/name/identifier when known.
 */
export async function GET() {
  const session = await getSessionWithRole();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawSessions = await listLiveConnectionSessions();
  const totalConnections = rawSessions.length;

  const userIds = [...new Set(rawSessions.map((s) => s.endUserId).filter(Boolean))] as string[];

  const userById = new Map<
    string,
    { email: string | null; name: string | null; identifier: string }
  >();

  if (userIds.length > 0) {
    const rows = await db
      .select({
        id: endUsers.id,
        email: endUsers.email,
        name: endUsers.name,
        identifier: endUsers.identifier,
      })
      .from(endUsers)
      .where(inArray(endUsers.id, userIds));
    for (const r of rows) {
      userById.set(r.id, {
        email: r.email,
        name: r.name,
        identifier: r.identifier,
      });
    }
  }

  const sessions = rawSessions.map((s) => {
    const meta = s.endUserId ? userById.get(s.endUserId) : undefined;
    return {
      leaseId: s.leaseId,
      endUserId: s.endUserId,
      lastHeartbeatMs: s.lastHeartbeatMs,
      email: meta?.email ?? null,
      name: meta?.name ?? null,
      identifier: meta?.identifier ?? null,
    };
  });

  return NextResponse.json({ totalConnections, sessions });
}
