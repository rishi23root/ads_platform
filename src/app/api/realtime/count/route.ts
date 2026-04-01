import { NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/dal';
import { getConnectionCount } from '@/lib/redis';

/**
 * GET /api/realtime/count
 * Returns the current number of extension users connected to the live SSE channel.
 * Requires a valid session (any dashboard role).
 */
export async function GET() {
  const session = await getSessionWithRole();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const count = await getConnectionCount();
  return NextResponse.json({ count });
}
