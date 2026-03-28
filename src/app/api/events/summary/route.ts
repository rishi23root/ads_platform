import { NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/dal';
import { aggregateEventStats } from '@/lib/events-dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const row = await aggregateEventStats(sessionWithRole.role, sessionWithRole.user.id, {});

  const empty = { total: 0, uniqueUsers: 0, ad: 0, popup: 0, notification: 0, redirect: 0, visit: 0, request: 0 };
  if (!row) return NextResponse.json(empty);

  return NextResponse.json({
    total: Number(row.total),
    uniqueUsers: Number(row.uniqueUsers),
    ad: Number(row.ad),
    popup: Number(row.popup),
    notification: Number(row.notification),
    redirect: Number(row.redirect),
    visit: Number(row.visit),
    request: Number(row.request),
  });
}
