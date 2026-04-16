import 'server-only';

import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';

/** Geo hints from Vercel / Cloudflare edge (same precedence as extension qualify context). */
export function countryCodeFromRequestHeaders(request: NextRequest): string | null {
  const vercel = request.headers.get('x-vercel-ip-country')?.trim().toUpperCase();
  if (vercel && vercel.length === 2) return vercel;
  const cf = request.headers.get('cf-ipcountry')?.trim().toUpperCase();
  if (cf && cf.length === 2 && cf !== 'XX') return cf;
  return null;
}

/** Persists `country` when the row has none so dashboards and geo targeting can use `end_users.country`. */
export async function backfillEndUserCountryIfEmpty(
  user: EndUserRow,
  countryCode: string
): Promise<EndUserRow> {
  const existing = user.country?.trim().toUpperCase();
  if (existing && existing.length === 2) return user;

  const [updated] = await db
    .update(endUsers)
    .set({ country: countryCode, updatedAt: new Date() })
    .where(eq(endUsers.id, user.id))
    .returning();

  return updated ?? user;
}
