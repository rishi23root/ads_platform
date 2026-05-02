import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { database as db } from '@/db';
import { targetLists } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { parsePagination } from '@/lib/pagination';
import {
  assertAllEndUsersExist,
  normalizeExcludedIds,
  normalizeMemberIds,
  parseTargetListFilterJson,
  validateTargetListPayload,
} from '@/lib/target-list-api-body';
import { serializeTargetListRow } from '@/lib/target-list-api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { limit, offset } = parsePagination(request);
    const rows = await db
      .select()
      .from(targetLists)
      .orderBy(desc(targetLists.updatedAt))
      .limit(limit)
      .offset(offset);
    const result = rows.map(serializeTargetListRow);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api/target-lists GET]', e);
    return NextResponse.json({ error: 'Failed to fetch target lists' }, { status: 500 });
  }
}

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
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name || name.length > 255) {
      return NextResponse.json({ error: 'Name is required (max 255 chars)' }, { status: 400 });
    }

    const filterJson = parseTargetListFilterJson(o.filterJson);
    const memberNorm = normalizeMemberIds(o.memberIds);
    if (memberNorm === null) {
      return NextResponse.json({ error: 'memberIds must be an array of UUID strings' }, { status: 400 });
    }
    const excludedNorm = normalizeExcludedIds(o.excludedIds);
    if (excludedNorm === null) {
      return NextResponse.json({ error: 'excludedIds must be an array of UUID strings' }, { status: 400 });
    }

    const v = validateTargetListPayload({ filterJson, memberIds: memberNorm });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    if (!(await assertAllEndUsersExist([...memberNorm, ...excludedNorm]))) {
      return NextResponse.json(
        { error: 'One or more member or excluded ids do not exist' },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(targetLists)
      .values({
        name,
        filterJson,
        memberIds: memberNorm,
        excludedIds: excludedNorm,
      })
      .returning();

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create target list' }, { status: 500 });
    }

    return NextResponse.json(serializeTargetListRow(inserted), { status: 201 });
  } catch (e) {
    console.error('[api/target-lists POST]', e);
    return NextResponse.json({ error: 'Failed to create target list' }, { status: 500 });
  }
}
