import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/dal';
import { isValidEndUserUuid } from '@/lib/end-user-id';
import { countEvents, listEventsPage } from '@/lib/events-dashboard';

export const dynamic = 'force-dynamic';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const gate = await requireApiSession({ role: 'admin' });
    if ('response' in gate) return gate.response;

    const { id } = await context.params;
    if (!isValidEndUserUuid(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
    const pageSize = Math.min(
      Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const from = searchParams.get('from')?.trim() || undefined;
    const to = searchParams.get('to')?.trim() || undefined;

    const filters = {
      endUserIdExact: id,
      from,
      to,
    };

    const offset = (page - 1) * pageSize;
    const [total, rows] = await Promise.all([
      countEvents(gate.session.role, gate.session.user.id, filters),
      listEventsPage(gate.session.role, gate.session.user.id, filters, {
        limit: pageSize,
        offset,
      }),
    ]);

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        userIdentifier: r.userIdentifier,
        endUserUuid: r.endUserUuid,
        email: r.email,
        plan: r.plan,
        campaignId: r.campaignId,
        domain: r.domain,
        type: r.type,
        country: r.country,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[api/end-users/[id]/events GET]', error);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
