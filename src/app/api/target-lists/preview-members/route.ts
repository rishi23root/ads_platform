import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/dal';
import {
  normalizeExcludedIds,
  normalizeMemberIds,
  parseTargetListFilterJson,
} from '@/lib/target-list-api-body';
import { isTargetListFilterEmpty } from '@/lib/target-list-filter';
import {
  countTargetListMembers,
  listTargetListMembers,
  type TargetListMembersListInput,
} from '@/lib/target-list-members-query';

export const dynamic = 'force-dynamic';

const MAX_PAGE_SIZE = 50;

export async function POST(request: NextRequest) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (s.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const o = body as Record<string, unknown>;

    const memberNorm = normalizeMemberIds(o.memberIds);
    if (memberNorm === null) {
      return NextResponse.json({ error: 'memberIds must be an array of UUID strings' }, { status: 400 });
    }
    const excludedNorm = normalizeExcludedIds(o.excludedIds);
    if (excludedNorm === null) {
      return NextResponse.json({ error: 'excludedIds must be an array of UUID strings' }, { status: 400 });
    }

    const filterJson = parseTargetListFilterJson(o.filterJson);

    if (isTargetListFilterEmpty(filterJson) && memberNorm.length === 0) {
      return NextResponse.json({
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
      });
    }

    const page = Math.max(1, parseInt(String(o.page ?? '1'), 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(String(o.pageSize ?? '25'), 10) || 25)
    );

    const listIn: TargetListMembersListInput = {
      id: 'preview',
      memberIds: memberNorm,
      excludedIds: excludedNorm,
      filterJson,
    };

    const [rows, totalCount] = await Promise.all([
      listTargetListMembers(listIn, { source: 'all', page, pageSize }),
      countTargetListMembers(listIn, 'all'),
    ]);

    return NextResponse.json({
      rows,
      totalCount,
      page,
      pageSize,
    });
  } catch (e) {
    console.error('[api/target-lists/preview-members POST]', e);
    return NextResponse.json({ error: 'Failed to preview members' }, { status: 500 });
  }
}
