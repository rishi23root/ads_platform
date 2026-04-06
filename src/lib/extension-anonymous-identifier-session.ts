import 'server-only';

import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';
import { allocateUniqueEndUserIdentifier } from '@/lib/enduser-merge';
import { computeTrialEndDateFromNow } from '@/lib/extension-user-subscription';

/** Drizzle/postgres-js wraps DB errors: outer message is "Failed query…"; 23505 lives on `cause`. */
export function isUniqueConstraintViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 12 && e; i++) {
    if (typeof e === 'object' && e !== null && 'code' in e) {
      const code = (e as { code: unknown }).code;
      if (code === '23505' || code === 23505) return true;
    }
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === 'object' &&
            e !== null &&
            'message' in e &&
            typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : '';
    const lower = msg.toLowerCase();
    if (lower.includes('unique') || lower.includes('duplicate')) {
      return true;
    }
    e =
      e instanceof Error
        ? e.cause
        : typeof e === 'object' && e !== null && 'cause' in e
          ? (e as { cause: unknown }).cause
          : undefined;
  }
  return false;
}

export type GetOrCreateAnonymousByIdentifierResult =
  | {
      ok: true;
      endUser: EndUserRow;
      identifierRegenerated: boolean;
      status: 200 | 201;
    }
  | { ok: false; error: 'banned' | 'insert_failed' | 'conflict' };

/**
 * Anonymous extension user by device `identifier`: reuse row, create new, or allocate a fresh
 * identifier when the requested one is already tied to an email account (same as register).
 */
export async function getOrCreateAnonymousEndUserByIdentifier(params: {
  identifier: string;
  name?: string | null;
  plan?: 'trial' | 'paid';
}): Promise<GetOrCreateAnonymousByIdentifierResult> {
  const trialEnd = computeTrialEndDateFromNow();
  const idKey = params.identifier;
  const name = params.name ?? null;
  const plan = params.plan ?? 'trial';

  const [existingAnon] = await db
    .select()
    .from(endUsers)
    .where(eq(endUsers.identifier, idKey))
    .limit(1);

  if (existingAnon) {
    if (existingAnon.email !== null) {
      const allocated = await allocateUniqueEndUserIdentifier();
      const [created] = await db
        .insert(endUsers)
        .values({
          identifier: allocated,
          email: null,
          passwordHash: null,
          name,
          plan,
          banned: false,
          endDate: trialEnd,
        })
        .returning();

      if (!created) {
        return { ok: false, error: 'insert_failed' };
      }

      return {
        ok: true,
        endUser: created,
        identifierRegenerated: true,
        status: 201,
      };
    }
    if (existingAnon.banned) {
      return { ok: false, error: 'banned' };
    }
    return {
      ok: true,
      endUser: existingAnon,
      identifierRegenerated: false,
      status: 200,
    };
  }

  try {
    const [created] = await db
      .insert(endUsers)
      .values({
        identifier: idKey,
        email: null,
        passwordHash: null,
        name,
        plan,
        banned: false,
        endDate: trialEnd,
      })
      .returning();

    if (!created) {
      return { ok: false, error: 'insert_failed' };
    }

    return {
      ok: true,
      endUser: created,
      identifierRegenerated: false,
      status: 201,
    };
  } catch (insertErr: unknown) {
    if (!isUniqueConstraintViolation(insertErr)) {
      throw insertErr;
    }
    const [again] = await db
      .select()
      .from(endUsers)
      .where(eq(endUsers.identifier, idKey))
      .limit(1);
    if (again && again.email === null && !again.banned) {
      return {
        ok: true,
        endUser: again,
        identifierRegenerated: false,
        status: 200,
      };
    }
    if (again && again.email !== null) {
      const allocated = await allocateUniqueEndUserIdentifier();
      const [created] = await db
        .insert(endUsers)
        .values({
          identifier: allocated,
          email: null,
          passwordHash: null,
          name,
          plan,
          banned: false,
          endDate: trialEnd,
        })
        .returning();
      if (!created) {
        return { ok: false, error: 'insert_failed' };
      }
      return {
        ok: true,
        endUser: created,
        identifierRegenerated: true,
        status: 201,
      };
    }
    return { ok: false, error: 'conflict' };
  }
}
