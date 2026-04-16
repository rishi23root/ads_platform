import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import { getOrCreateAnonymousEndUserByIdentifier } from '@/lib/extension-anonymous-identifier-session';
import {
  consolidateAnonymousWithEmailUserAfterLogin,
  extensionEndUserIdentifierSchema,
} from '@/lib/enduser-merge';
import {
  createEnduserSession,
  endUserPublicPayload,
  verifyEnduserPassword,
} from '@/lib/enduser-auth';
import {
  backfillEndUserCountryIfEmpty,
  countryCodeFromRequestHeaders,
} from '@/lib/enduser-request-country';

export const dynamic = 'force-dynamic';

function logAuthFailure(message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[api/extension/auth/login] ${message}`, meta ?? '');
  }
}

const loginWithEmailSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
  identifier: extensionEndUserIdentifierSchema.optional(),
});

const loginAnonymousSchema = z.object({
  identifier: extensionEndUserIdentifierSchema,
});

const loginSchema = z.union([loginWithEmailSchema, loginAnonymousSchema]);

/**
 * POST /api/extension/auth/login — email/password session (optional device merge), or anonymous
 * session with `identifier` only (same rules as register when id is linked to an email account).
 *
 * Input: JSON `{ email, password, identifier? }` or `{ identifier }`.
 * A valid ISO 3166-1 alpha-2 country must be present on the request via edge headers
 * (`x-vercel-ip-country` or `cf-ipcountry`). When `end_users.country` is empty, it is set from that value.
 *
 * Output: `200`|`201` `{ token, expiresAt (ISO), user, identifier?, identifierReplaced?,
 * identifierRegenerated? }`.
 * Errors: `400` invalid/validation; `401` bad credentials; `403` banned; `500` server.
 */
export async function POST(request: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const countryCode = countryCodeFromRequestHeaders(request);
    if (!countryCode) {
      return NextResponse.json(
        {
          error:
            'Country could not be determined: request must include x-vercel-ip-country or cf-ipcountry (ISO 3166-1 alpha-2)',
        },
        { status: 400 }
      );
    }

    if (!('email' in body)) {
      const anonResult = await getOrCreateAnonymousEndUserByIdentifier({
        identifier: body.identifier,
      });
      if (!anonResult.ok) {
        if (anonResult.error === 'banned') {
          return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
        }
        if (anonResult.error === 'conflict') {
          return NextResponse.json(
            { error: 'Email or identifier already in use' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
      }

      const endUser = await backfillEndUserCountryIfEmpty(anonResult.endUser, countryCode);

      const { token, expiresAt } = await createEnduserSession({
        endUserId: endUser.id,
        request,
      });

      const canonicalIdentifier = endUser.identifier;
      return NextResponse.json(
        {
          token,
          expiresAt: expiresAt.toISOString(),
          user: endUserPublicPayload(endUser),
          identifier: canonicalIdentifier,
          ...(anonResult.identifierRegenerated ? { identifierRegenerated: true } : {}),
        },
        { status: anonResult.status }
      );
    }

    const email = body.email.toLowerCase();
    const [row] = await db.select().from(endUsers).where(eq(endUsers.email, email)).limit(1);

    if (!row?.passwordHash) {
      logAuthFailure('401: no end user with this email, or user has no password (e.g. anonymous-only)', {
        email,
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!verifyEnduserPassword(body.password, row.passwordHash)) {
      logAuthFailure('401: password did not verify', { email });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (row.banned) {
      return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
    }

    const idKey = body.identifier;
    let sessionUser = idKey
      ? await consolidateAnonymousWithEmailUserAfterLogin({ emailUser: row, identifier: idKey })
      : row;

    sessionUser = await backfillEndUserCountryIfEmpty(sessionUser, countryCode);

    const { token, expiresAt } = await createEnduserSession({
      endUserId: sessionUser.id,
      request,
    });

    const canonicalIdentifier = sessionUser.identifier;
    const requestedIdentifier = idKey ?? null;
    const identifierReplaced =
      requestedIdentifier !== null &&
      (canonicalIdentifier === null || canonicalIdentifier !== requestedIdentifier);


    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: endUserPublicPayload(sessionUser),
      identifier: canonicalIdentifier,
      ...(identifierReplaced ? { identifierReplaced: true } : {}),
    });
  } catch (error) {
    console.error('[api/extension/auth/login]', error);
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
  }
}
