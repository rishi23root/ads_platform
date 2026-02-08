import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/dal';
import { getConnectionCount } from '@/lib/redis';

/**
 * GET /api/realtime/count
 * Returns the current number of extension users connected to the live SSE channel.
 * Admin-only (requires valid session).
 */
export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const count = await getConnectionCount();
  return NextResponse.json({ count });
}
