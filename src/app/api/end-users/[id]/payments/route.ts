import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, payments } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().trim().length(3).default('USD'),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).default('completed'),
  description: z.string().trim().max(2000).optional(),
  paymentDate: z.string().datetime().optional(),
  /** When set, also updates `end_users.end_date` for this user (access end). */
  endDate: z.string().datetime().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const [user] = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.id, id)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.endUserId, id))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('[api/end-users/[id]/payments GET]', error);
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const [user] = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.id, id)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const p = parsed.data;
    const [row] = await db
      .insert(payments)
      .values({
        endUserId: id,
        amount: p.amount,
        currency: p.currency.toUpperCase(),
        status: p.status,
        description: p.description ?? null,
        paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
      })
      .returning();

    if (p.endDate) {
      await db
        .update(endUsers)
        .set({ endDate: new Date(p.endDate), updatedAt: new Date() })
        .where(eq(endUsers.id, id));
    }

    return NextResponse.json({ payment: row }, { status: 201 });
  } catch (error) {
    console.error('[api/end-users/[id]/payments POST]', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
