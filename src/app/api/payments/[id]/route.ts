import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, payments } from '@/db/schema';
import { requireApiSession } from '@/lib/dal';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  amount: z.number().int().positive().optional(),
  currency: z.string().trim().length(3).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  paymentDate: z.string().datetime().optional(),
  /** When set, updates this user's `end_users.end_date` (null clears). */
  endDate: z.string().datetime().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const gate = await requireApiSession({ role: 'admin' });
    if ('response' in gate) return gate.response;

    const { id } = await context.params;
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const p = parsed.data;
    const updates: Partial<typeof payments.$inferInsert> = {};
    if (p.amount !== undefined) updates.amount = p.amount;
    if (p.currency !== undefined) updates.currency = p.currency.toUpperCase();
    if (p.status !== undefined) updates.status = p.status;
    if (p.description !== undefined) updates.description = p.description;
    if (p.paymentDate !== undefined) updates.paymentDate = new Date(p.paymentDate);

    // Atomic: payment update + optional end-user endDate update land together.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(payments)
        .set(updates)
        .where(eq(payments.id, id))
        .returning();

      if (!row) return null;

      if (p.endDate !== undefined) {
        await tx
          .update(endUsers)
          .set({
            endDate: p.endDate ? new Date(p.endDate) : null,
            updatedAt: new Date(),
          })
          .where(eq(endUsers.id, row.endUserId));
      }

      return row;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ payment: updated });
  } catch (error) {
    logger.error('[api/payments/[id] PATCH] failed', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const gate = await requireApiSession({ role: 'admin' });
    if ('response' in gate) return gate.response;

    const { id } = await context.params;
    const deleted = await db.delete(payments).where(eq(payments.id, id)).returning({ id: payments.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[api/payments/[id] DELETE] failed', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
