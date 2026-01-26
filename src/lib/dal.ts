import 'server-only';
import { getSession, type SessionPayload } from '@/lib/auth';
import { cache } from 'react';

// Cache the session verification to avoid multiple checks in the same request
export const verifySession = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  
  if (!session) {
    return null;
  }

  // Check if session is expired
  if (new Date(session.expiresAt) < new Date()) {
    return null;
  }

  return session;
});

// Helper to get the current user (throws if not authenticated)
export const getCurrentUser = cache(async (): Promise<SessionPayload> => {
  const session = await verifySession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  return session;
});
