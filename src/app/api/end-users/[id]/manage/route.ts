import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, enduserSessions, payments } from '@/db/schema';
import { requireApiSession } from '@/lib/dal';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const gate = await requireApiSession({ role: 'admin' });
    if ('response' in gate) return gate.response;

    const { id: endUserId } = await context.params;
    const [user] = await db
      .select({ id: endUsers.id })
      .from(endUsers)
      .where(eq(endUsers.id, endUserId))
      .limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const now = new Date();

    const [sessionRows, paymentRows] = await Promise.all([
      db
        .select({
          id: enduserSessions.id,
          createdAt: enduserSessions.createdAt,
          expiresAt: enduserSessions.expiresAt,
          userAgent: enduserSessions.userAgent,
          ipAddress: enduserSessions.ipAddress,
        })
        .from(enduserSessions)
        .where(eq(enduserSessions.endUserId, endUserId))
        .orderBy(desc(enduserSessions.createdAt)),
      db
        .select()
        .from(payments)
        .where(eq(payments.endUserId, endUserId))
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt)),
    ]);

    const sessions = sessionRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      active: r.expiresAt > now,
    }));

    const paymentList = paymentRows.map((p) => ({
      id: p.id,
      endUserId: p.endUserId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      description: p.description,
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ sessions, payments: paymentList });
  } catch (error) {
    console.error('[api/end-users/[id]/manage GET]', error);
    return NextResponse.json({ error: 'Failed to load manage data' }, { status: 500 });
  }
}
