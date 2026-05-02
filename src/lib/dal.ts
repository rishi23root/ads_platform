import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export type SessionWithRole = Awaited<ReturnType<typeof getSessionWithRole>>;

async function fetchSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

// Cache the session verification to avoid multiple checks in the same request
export const verifySession = cache(async () => {
  const data = await fetchSession();
  return data ?? null;
});

/** Returns { user, role } or null. Role is from user.role ('user' | 'admin'). */
export const getSessionWithRole = cache(async () => {
  const data = await verifySession();
  if (!data?.user) return null;
  const role = (data.user as { role?: 'user' | 'admin' }).role ?? 'user';
  return { user: data.user, role } as const;
});

// Helper to get the current user (throws if not authenticated)
export const getCurrentUser = cache(async () => {
  const data = await verifySession();
  if (!data?.user) {
    throw new Error('Not authenticated');
  }
  return data.user;
});

/**
 * API-route auth gate. Returns either a resolved `{ session }` or a ready-to-return `NextResponse`
 * (401 / 403). `role: 'admin'` enforces admin-only access; defaults to any authenticated staff user.
 *
 * Usage:
 *   const gate = await requireApiSession({ role: 'admin' });
 *   if ('response' in gate) return gate.response;
 *   // ... use gate.session
 */
export async function requireApiSession(options?: {
  role?: 'admin';
}): Promise<
  | { session: NonNullable<SessionWithRole> }
  | { response: NextResponse }
> {
  const session = await getSessionWithRole();
  if (!session) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (options?.role === 'admin' && session.role !== 'admin') {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { session };
}
