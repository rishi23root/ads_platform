import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import {
  getOrCreateAnonymousEndUserByIdentifier,
  isUniqueConstraintViolation,
} from '@/lib/extension-anonymous-identifier-session';
import {
  allocateUniqueEndUserIdentifier,
  extensionEndUserIdentifierSchema,
} from '@/lib/enduser-merge';
import {
  createEnduserSession,
  endUserPublicPayload,
  hashEnduserPassword,
} from '@/lib/enduser-auth';
import {
  clientIpFromRequest,
  consumeRateLimit,
  maskEmailForLog,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Register is much cheaper for us than for an attacker (bcrypt is the hot spot), so this limit
 * is tighter than login to keep sustained floods from pegging CPU. */
const REGISTER_RATE = { name: 'ext-register', limit: 5, windowSec: 60 } as const;

function logRegisterConflict(message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[api/extension/auth/register] ${message}`, meta);
  }
}

const registerSchema = z
  .object({
    email: z.string().trim().email().max(255).optional(),
    password: z.string().min(8).max(128).optional(),
    identifier: extensionEndUserIdentifierSchema.optional(),
    name: z.string().trim().max(255).nullable().optional(),
    plan: z.enum(['trial', 'paid']).optional(),
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

/**
 * POST /api/extension/auth/register — create session (anonymous and/or email signup).
 *
 * Input: JSON. No `Authorization` header. Provide `identifier` and/or `email`+`password` per Zod `registerSchema`; optional `name`, `plan`.
 *
 * Output: `200`|`201` `{ token, expiresAt (ISO), user }`; may include `identifierRegenerated`.
 * Errors: `400` invalid JSON / validation; `403` banned; `409` email/identifier conflict; `500` server.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request);
    const rl = await consumeRateLimit(ip, REGISTER_RATE);
    if (!rl.allowed) return rateLimitResponse(rl);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const p = parsed.data;

    if (p.email?.length) {
      const normalizedEmail = p.email.toLowerCase();
      const idKey = p.identifier?.trim();

      if (idKey) {
        const [anonByDevice] = await db
          .select()
          .from(endUsers)
          .where(eq(endUsers.identifier, idKey))
          .limit(1);

        if (anonByDevice && anonByDevice.email === null) {
          if (anonByDevice.banned) {
            return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
          }
          const [emailOwner] = await db
            .select()
            .from(endUsers)
            .where(eq(endUsers.email, normalizedEmail))
            .limit(1);
          if (emailOwner && emailOwner.id !== anonByDevice.id) {
            logRegisterConflict('409: email belongs to a different user than this identifier', {
              email: maskEmailForLog(normalizedEmail),
            });
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
          }

          const [upgraded] = await db
            .update(endUsers)
            .set({
              email: normalizedEmail,
              passwordHash: hashEnduserPassword(p.password!),
              name: p.name ?? anonByDevice.name,
              plan: p.plan ?? anonByDevice.plan,
              updatedAt: new Date(),
            })
            .where(eq(endUsers.id, anonByDevice.id))
            .returning();

          if (!upgraded) {
            return NextResponse.json({ error: 'Update failed' }, { status: 500 });
          }

          const { token, expiresAt } = await createEnduserSession({
            endUserId: upgraded.id,
            request,
          });

          return NextResponse.json(
            {
              token,
              expiresAt: expiresAt.toISOString(),
              user: endUserPublicPayload(upgraded),
            },
            { status: 201 }
          );
        }

        if (anonByDevice && anonByDevice.email !== null) {
          if (anonByDevice.email.toLowerCase() === normalizedEmail) {
            logRegisterConflict('409: email already registered on holder of this identifier', {
              email: maskEmailForLog(normalizedEmail),
            });
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
          }
          const allocated = await allocateUniqueEndUserIdentifier();
          const [created] = await db
            .insert(endUsers)
            .values({
              email: normalizedEmail,
              passwordHash: hashEnduserPassword(p.password!),
              identifier: allocated,
              name: p.name ?? null,
              plan: p.plan ?? 'trial',
              banned: false,
            })
            .returning();

          if (!created) {
            return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
          }

          const { token, expiresAt } = await createEnduserSession({
            endUserId: created.id,
            request,
          });

          return NextResponse.json(
            {
              token,
              expiresAt: expiresAt.toISOString(),
              user: endUserPublicPayload(created),
              identifierRegenerated: true,
            },
            { status: 201 }
          );
        }
      }

      let useIdentifier: string | null = p.identifier?.trim() ?? null;
      let identifierRegenerated = false;
      if (!useIdentifier) {
        useIdentifier = await allocateUniqueEndUserIdentifier();
        identifierRegenerated = true;
      }

      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const [created] = await db
            .insert(endUsers)
            .values({
              email: normalizedEmail,
              passwordHash: hashEnduserPassword(p.password!),
              identifier: useIdentifier,
              name: p.name ?? null,
              plan: p.plan ?? 'trial',
              banned: false,
            })
            .returning();

          if (!created) {
            return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
          }

          const { token, expiresAt } = await createEnduserSession({
            endUserId: created.id,
            request,
          });

          return NextResponse.json(
            {
              token,
              expiresAt: expiresAt.toISOString(),
              user: endUserPublicPayload(created),
              ...(identifierRegenerated ? { identifierRegenerated: true } : {}),
            },
            { status: 201 }
          );
        } catch (insertErr: unknown) {
          if (!isUniqueConstraintViolation(insertErr)) {
            throw insertErr;
          }
          const [emailOwner] = await db
            .select()
            .from(endUsers)
            .where(eq(endUsers.email, normalizedEmail))
            .limit(1);
          if (emailOwner) {
            logRegisterConflict('409: email already exists (insert race or duplicate)', {
              email: maskEmailForLog(normalizedEmail),
            });
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
          }
          useIdentifier = await allocateUniqueEndUserIdentifier();
          identifierRegenerated = true;
        }
      }

      return NextResponse.json({ error: 'Failed to allocate identifier' }, { status: 500 });
    }

    const idKey = p.identifier!;
    const anonResult = await getOrCreateAnonymousEndUserByIdentifier({
      identifier: idKey,
      name: p.name,
      plan: p.plan,
    });
    if (!anonResult.ok) {
      if (anonResult.error === 'banned') {
        return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
      }
      if (anonResult.error === 'conflict') {
        logRegisterConflict('409: unique constraint after concurrent anonymous insert');
        return NextResponse.json(
          { error: 'Email or identifier already in use' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    const { token, expiresAt } = await createEnduserSession({
      endUserId: anonResult.endUser.id,
      request,
    });

    return NextResponse.json(
      {
        token,
        expiresAt: expiresAt.toISOString(),
        user: endUserPublicPayload(anonResult.endUser),
        ...(anonResult.identifierRegenerated ? { identifierRegenerated: true } : {}),
      },
      { status: anonResult.status }
    );
  } catch (error: unknown) {
    if (isUniqueConstraintViolation(error)) {
      logRegisterConflict('409: unique constraint (email or identifier)', {
        during: 'register',
      });
      return NextResponse.json(
        { error: 'Email or identifier already in use' },
        { status: 409 }
      );
    }
    logger.error('[api/extension/auth/register] failed', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
