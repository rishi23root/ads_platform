import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, targetLists } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { normalizeMemberIds } from '@/lib/target-list-api-body';
import type { TargetListFilterJson } from '@/lib/target-list-filter';
import { targetListFilterMatchesEndUser } from '@/lib/target-list-filter';
import { summarizeFilter } from '@/lib/target-list-filter';
import {
  countTargetListMembers,
  countTargetListMembersByTab,
  listTargetListMembers,
  type TargetListMembersListInput,
  type TargetListMemberTabSource,
} from '@/lib/target-list-members-query';
import { fetchRedirectCampaignIdsForList } from '@/lib/target-list-queries';
import { publishCampaignUpdated } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const MAX_BATCH = 500;

function parseSource(raw: string | null): TargetListMemberTabSource {
  if (raw === 'explicit' || raw === 'filter' || raw === 'excluded') return raw;
  return 'all';
}

async function publishRedirectUpdatesForList(listId: string): Promise<void> {
  const ids = await fetchRedirectCampaignIdsForList(listId);
  for (const campaignId of ids) {
    await publishCampaignUpdated(campaignId);
  }
}

function toListInput(row: typeof targetLists.$inferSelect): TargetListMembersListInput {
  return {
    id: row.id,
    memberIds: [...(row.memberIds ?? [])],
    excludedIds: [...(row.excludedIds ?? [])],
    filterJson: row.filterJson,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [row] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sp = request.nextUrl.searchParams;
    const source = parseSource(sp.get('source'));
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '25', 10) || 25));

    const listIn = toListInput(row);
    const [rows, totalCount, tabCounts] = await Promise.all([
      listTargetListMembers(listIn, { source, page, pageSize }),
      countTargetListMembers(listIn, source),
      countTargetListMembersByTab(listIn),
    ]);

    const filterJson = row.filterJson as TargetListFilterJson;

    return NextResponse.json({
      rows,
      totalCount,
      source,
      page,
      pageSize,
      list: {
        id: row.id,
        name: row.name,
        filterSummary: summarizeFilter(filterJson),
        tabCounts: tabCounts,
        explicitMemberCount: (row.memberIds ?? []).length,
        excludedCount: (row.excludedIds ?? []).length,
      },
    });
  } catch (e) {
    console.error('[api/target-lists/[id]/members GET]', e);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (s.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const [existing] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const userIds = normalizeMemberIds(o.userIds);
    if (userIds === null) {
      return NextResponse.json({ error: 'userIds must be an array of UUID strings' }, { status: 400 });
    }
    if (userIds.length === 0) {
      return NextResponse.json({ error: 'userIds must not be empty' }, { status: 400 });
    }
    if (userIds.length > MAX_BATCH) {
      return NextResponse.json({ error: `At most ${MAX_BATCH} users per request` }, { status: 400 });
    }

    const unexcludeOnly = o.unexcludeOnly === true;

    const found = await db.select({ id: endUsers.id }).from(endUsers).where(inArray(endUsers.id, userIds));
    if (found.length !== userIds.length) {
      return NextResponse.json({ error: 'One or more user ids do not exist' }, { status: 400 });
    }

    const addSet = new Set(userIds);
    const nextExcluded = [...(existing.excludedIds ?? []).filter((x) => !addSet.has(x))];
    const nextMembers = unexcludeOnly
      ? [...(existing.memberIds ?? [])]
      : [...new Set([...(existing.memberIds ?? []), ...userIds])];

    const now = new Date();
    const [updated] = await db
      .update(targetLists)
      .set({
        memberIds: nextMembers,
        excludedIds: nextExcluded,
        updatedAt: now,
      })
      .where(eq(targetLists.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    await publishRedirectUpdatesForList(id);

    return NextResponse.json({
      ok: true,
      memberIds: [...(updated.memberIds ?? [])],
      excludedIds: [...(updated.excludedIds ?? [])],
    });
  } catch (e) {
    console.error('[api/target-lists/[id]/members POST]', e);
    return NextResponse.json({ error: 'Failed to update members' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (s.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const [existing] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const userIds = normalizeMemberIds((body as Record<string, unknown>).userIds);
    if (userIds === null) {
      return NextResponse.json({ error: 'userIds must be an array of UUID strings' }, { status: 400 });
    }
    if (userIds.length === 0) {
      return NextResponse.json({ error: 'userIds must not be empty' }, { status: 400 });
    }
    if (userIds.length > MAX_BATCH) {
      return NextResponse.json({ error: `At most ${MAX_BATCH} users per request` }, { status: 400 });
    }

    const found = await db.select().from(endUsers).where(inArray(endUsers.id, userIds));
    if (found.length !== userIds.length) {
      return NextResponse.json({ error: 'One or more user ids do not exist' }, { status: 400 });
    }

    const removeSet = new Set(userIds);
    const filterJson = existing.filterJson as TargetListFilterJson;

    let nextMembers = [...(existing.memberIds ?? []).filter((mid) => !removeSet.has(mid))];
    const nextExcluded = new Set([...(existing.excludedIds ?? [])]);

    for (const row of found) {
      if (targetListFilterMatchesEndUser(filterJson, row)) {
        nextExcluded.add(row.id);
      }
    }

    const now = new Date();
    const [updated] = await db
      .update(targetLists)
      .set({
        memberIds: nextMembers,
        excludedIds: [...nextExcluded],
        updatedAt: now,
      })
      .where(eq(targetLists.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    await publishRedirectUpdatesForList(id);

    return NextResponse.json({
      ok: true,
      memberIds: [...(updated.memberIds ?? [])],
      excludedIds: [...(updated.excludedIds ?? [])],
    });
  } catch (e) {
    console.error('[api/target-lists/[id]/members DELETE]', e);
    return NextResponse.json({ error: 'Failed to remove members' }, { status: 500 });
  }
}
