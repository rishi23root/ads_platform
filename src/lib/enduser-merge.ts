import 'server-only';

import { randomBytes } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { database as db } from '@/db';
import { endUsers, enduserEvents, payments } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';

/** Same rules as extension register: device id for anonymous users. */
export const extensionEndUserIdentifierSchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/);

/**
 * New device id when the client-supplied identifier is already tied to another account.
 * Matches `extensionEndUserIdentifierSchema` (alnum + underscore).
 */
export async function allocateUniqueEndUserIdentifier(): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const candidate = `ext_${randomBytes(16).toString('hex')}`;
    const [row] = await db
      .select({ id: endUsers.id })
      .from(endUsers)
      .where(eq(endUsers.identifier, candidate))
      .limit(1);
    if (!row) return candidate;
  }
  throw new Error('allocateUniqueEndUserIdentifier: could not allocate after retries');
}

/** Value stored on `enduser_events.user_identifier` (always `end_users.identifier`). */
export function userIdentifierForEndUser(user: EndUserRow): string {
  const id = user.identifier?.trim();
  if (!id) throw new Error('userIdentifierForEndUser: missing identifier');
  return id;
}

/**
 * After successful email login with optional device `identifier`: if an anonymous row exists for
 * that identifier, keep its primary key (`end_users.id`) so existing `enduser_events` stay valid.
 * Rows and secrets from the email-only account are merged in: events/payments move anonymous-ward,
 * then the email-only row is removed and credentials are written onto the former anonymous row.
 */
export async function consolidateAnonymousWithEmailUserAfterLogin(params: {
  emailUser: EndUserRow;
  identifier: string;
}): Promise<EndUserRow> {
  const { emailUser, identifier } = params;

  const [anon] = await db
    .select()
    .from(endUsers)
    .where(and(eq(endUsers.identifier, identifier), isNull(endUsers.email)))
    .limit(1);

  if (!anon || anon.banned || anon.id === emailUser.id) {
    return emailUser;
  }

  return await db.transaction(async (tx) => {
    if (emailUser.identifier !== anon.identifier) {
      await tx
        .update(enduserEvents)
        .set({ userIdentifier: anon.identifier })
        .where(eq(enduserEvents.userIdentifier, emailUser.identifier));
    }

    await tx
      .update(payments)
      .set({ endUserId: anon.id })
      .where(eq(payments.endUserId, emailUser.id));

    await tx.delete(endUsers).where(eq(endUsers.id, emailUser.id));

    await tx
      .update(endUsers)
      .set({
        email: emailUser.email,
        passwordHash: emailUser.passwordHash,
        name: emailUser.name ?? anon.name,
        plan: emailUser.plan,
        country: emailUser.country ?? anon.country,
        endDate: emailUser.endDate ?? anon.endDate,
        updatedAt: new Date(),
      })
      .where(eq(endUsers.id, anon.id));

    const [fresh] = await tx.select().from(endUsers).where(eq(endUsers.id, anon.id)).limit(1);
    if (!fresh) {
      throw new Error('consolidateAnonymousWithEmailUserAfterLogin: row missing after update');
    }
    return fresh;
  });
}
