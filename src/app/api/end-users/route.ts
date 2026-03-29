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
import { endUserPublicPayload, hashEnduserPassword } from '@/lib/enduser-auth';
import {
  END_USER_IDENTIFIER_REGEX,
  endUserAdminCreateLimits,
} from '@/lib/end-user-admin-create';
import {
  computePaidSubscriptionEndFromNow,
  computeTrialEndDateFromNow,
} from '@/lib/extension-user-subscription';

export const dynamic = 'force-dynamic';

/**
 * Admin create body for `end_users` (POST /api/end-users).
 *
 * Minimum identity (one of):
 * - Registered: `email` + `password` (matches extension register flow).
 * - Anonymous: `identifier` only (8–255 chars, [a-zA-Z0-9_-]).
 *
 * Optional: `name`, `plan` (default trial), `banned` (default false), `identifier` alongside email,
 * `country` (ISO 3166-1 alpha-2). Omitted columns: `startDate`/`createdAt`/`updatedAt` use DB defaults;
 * anonymous creates set `endDate` to trial or paid window from now; email creates set `endDate` when
 * `plan` is `paid` (see `DEFAULT_PAID_SUBSCRIPTION_DAYS`), else leave null (trial; UI infers end from start).
 */
const identifierSchema = z
  .string()
  .trim()
  .min(endUserAdminCreateLimits.identifierMin)
  .max(endUserAdminCreateLimits.identifierMax)
  .regex(END_USER_IDENTIFIER_REGEX);

const createSchema = z
  .object({
    email: z.string().trim().email().max(endUserAdminCreateLimits.emailMax).optional(),
    password: z
      .string()
      .min(endUserAdminCreateLimits.passwordMin)
      .max(endUserAdminCreateLimits.passwordMax)
      .optional(),
    identifier: identifierSchema.optional(),
    name: z.string().trim().max(endUserAdminCreateLimits.nameMax).nullable().optional(),
    plan: z.enum(['trial', 'paid']).optional(),
    banned: z.boolean().optional(),
    country: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null) return undefined;
        const s = v.trim();
        return s.length === 0 ? undefined : s.toUpperCase();
      })
      .refine((s) => s === undefined || /^[A-Z]{2}$/.test(s), {
        message: 'Country must be ISO 3166-1 alpha-2 (e.g. US)',
      }),
  })
  .superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email?.length);
    const hasIdentifier = Boolean(data.identifier?.length);
    if (!hasEmail && !hasIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email (with password) or identifier for an anonymous user',
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

    if (p.email?.length) {
      const normalizedEmail = p.email.toLowerCase();
      const plan = p.plan ?? 'trial';
      const [created] = await db
        .insert(endUsers)
        .values({
          email: normalizedEmail,
          passwordHash: hashEnduserPassword(p.password!),
          identifier: p.identifier ?? null,
          name: p.name ?? null,
          plan,
          banned: p.banned ?? false,
          country: p.country ?? null,
          ...(plan === 'paid' ? { endDate: computePaidSubscriptionEndFromNow() } : {}),
        })
        .returning();

      if (!created) {
        return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
      }
      return NextResponse.json({ user: endUserPublicPayload(created) }, { status: 201 });
    }

    const plan = p.plan ?? 'trial';
    const accessEnd =
      plan === 'paid' ? computePaidSubscriptionEndFromNow() : computeTrialEndDateFromNow();
    const [created] = await db
      .insert(endUsers)
      .values({
        identifier: p.identifier!,
        email: null,
        passwordHash: null,
        name: p.name ?? null,
        plan,
        banned: p.banned ?? false,
        country: p.country ?? null,
        endDate: accessEnd,
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
        { error: 'Email or identifier already in use' },
        { status: 409 }
      );
    }
    console.error('[api/end-users POST]', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
