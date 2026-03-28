import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, payments } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { endUserPublicPayload, hashEnduserPassword } from '@/lib/enduser-auth';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().trim().max(255).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  installationId: z
    .string()
    .trim()
    .min(8)
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .nullable()
    .optional(),
  plan: z.enum(['trial', 'paid']).optional(),
  status: z.enum(['active', 'suspended', 'churned']).optional(),
  country: z
    .string()
    .trim()
    .length(2)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  /** Admin-set password (optional). */
  password: z.string().min(8).max(128).optional(),
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
    const [user] = await db.select().from(endUsers).where(eq(endUsers.id, id)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [paySum] = await db
      .select({ n: sql<number>`count(*)::int`.as('n') })
      .from(payments)
      .where(eq(payments.endUserId, id));

    return NextResponse.json({
      user: endUserPublicPayload(user),
      paymentsCount: Number(paySum?.n ?? 0),
    });
  } catch (error) {
    console.error('[api/end-users/[id] GET]', error);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const [existing] = await db.select().from(endUsers).where(eq(endUsers.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

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
    const mergedEmail =
      p.email !== undefined ? (p.email === null ? null : p.email.toLowerCase()) : existing.email;
    const mergedInstallationId =
      p.installationId !== undefined ? p.installationId : existing.installationId;
    if (mergedEmail == null && mergedInstallationId == null) {
      return NextResponse.json(
        { error: 'User must have either email or installationId' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (p.name !== undefined) updates.name = p.name;
    if (p.email !== undefined) {
      updates.email = p.email === null ? null : p.email.toLowerCase();
    }
    if (p.installationId !== undefined) {
      updates.installationId = p.installationId;
    }
    if (p.plan !== undefined) updates.plan = p.plan;
    if (p.status !== undefined) updates.status = p.status;

    if (p.country !== undefined) {
      updates.country = p.country === null ? null : p.country.toUpperCase();
    }
    if (p.startDate !== undefined) {
      updates.startDate = new Date(p.startDate);
    }
    if (p.endDate !== undefined) {
      updates.endDate = p.endDate ? new Date(p.endDate) : null;
    }
    if (p.password !== undefined) {
      updates.passwordHash = hashEnduserPassword(p.password);
    }

    const [updated] = await db
      .update(endUsers)
      .set(updates as Partial<typeof endUsers.$inferInsert>)
      .where(eq(endUsers.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ user: endUserPublicPayload(updated) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    console.error('[api/end-users/[id] PATCH]', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const deleted = await db.delete(endUsers).where(eq(endUsers.id, id)).returning({ id: endUsers.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/end-users/[id] DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
