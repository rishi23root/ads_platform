import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
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
