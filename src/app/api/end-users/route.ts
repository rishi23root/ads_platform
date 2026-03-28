import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionWithRole } from '@/lib/dal';
import {
  parseEndUsersDashboardFilters,
  runEndUsersListQuery,
  countEndUsersListQuery,
} from '@/lib/end-users-dashboard';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import {
  allocateUniqueShortId,
  endUserPublicPayload,
  hashEnduserPassword,
} from '@/lib/enduser-auth';
import { computeTrialEndDateFromNow } from '@/lib/extension-user-subscription';

export const dynamic = 'force-dynamic';

const installationIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/);

const createSchema = z
  .object({
    email: z.string().trim().email().max(255).optional(),
    password: z.string().min(8).max(128).optional(),
    installationId: installationIdSchema.optional(),
    name: z.string().trim().max(255).nullable().optional(),
    plan: z.enum(['trial', 'paid']).optional(),
    status: z.enum(['active', 'suspended', 'churned']).optional(),
  })
  .superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email?.length);
    const hasInst = Boolean(data.installationId?.length);
    if (!hasEmail && !hasInst) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email (with password) or installationId for an anonymous user',
      });
    }
    if (hasEmail && !data.password?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required when email is set',
        path: ['password'],
      });
    }
  });

export async function GET(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filters = parseEndUsersDashboardFilters(searchParams);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
    const offset = (page - 1) * pageSize;

    const [rows, totalCount] = await Promise.all([
      runEndUsersListQuery(filters, { limit: pageSize, offset }),
      countEndUsersListQuery(filters),
    ]);

    return NextResponse.json({
      data: rows,
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (error) {
    console.error('[api/end-users GET]', error);
    return NextResponse.json({ error: 'Failed to load end users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    const shortId = await allocateUniqueShortId();

    if (p.email?.length) {
      const normalizedEmail = p.email.toLowerCase();
      const [created] = await db
        .insert(endUsers)
        .values({
          email: normalizedEmail,
          passwordHash: hashEnduserPassword(p.password!),
          shortId,
          name: p.name ?? null,
          plan: p.plan ?? 'trial',
          status: p.status ?? 'active',
          installationId: p.installationId ?? null,
        })
        .returning();

      if (!created) {
        return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
      }
      return NextResponse.json({ user: endUserPublicPayload(created) }, { status: 201 });
    }

    const trialEnd = computeTrialEndDateFromNow();
    const [created] = await db
      .insert(endUsers)
      .values({
        installationId: p.installationId!,
        shortId,
        email: null,
        passwordHash: null,
        name: p.name ?? null,
        plan: p.plan ?? 'trial',
        status: p.status ?? 'active',
        endDate: trialEnd,
      })
      .returning();

    if (!created) {
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ user: endUserPublicPayload(created) }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Email or installationId already in use' },
        { status: 409 }
      );
    }
    console.error('[api/end-users POST]', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
