import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { targetLists } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import {
  assertAllEndUsersExist,
  normalizeExcludedIds,
  normalizeMemberIds,
  parseTargetListFilterJson,
  validateTargetListPayload,
} from '@/lib/target-list-api-body';
import type { TargetListFilterJson } from '@/lib/target-list-filter';
import { serializeTargetListRow } from '@/lib/target-list-api-response';
import { fetchRedirectCampaignIdsForList } from '@/lib/target-list-queries';
import { publishCampaignUpdated } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function publishRedirectUpdatesForList(listId: string): Promise<void> {
  const ids = await fetchRedirectCampaignIdsForList(listId);
  for (const campaignId of ids) {
    await publishCampaignUpdated(campaignId);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [row] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(serializeTargetListRow(row));
  } catch (e) {
    console.error('[api/target-lists/[id] GET]', e);
    return NextResponse.json({ error: 'Failed to fetch target list' }, { status: 500 });
  }
}

export async function PUT(
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

    const name =
      o.name !== undefined
        ? typeof o.name === 'string'
          ? o.name.trim()
          : ''
        : existing.name;
    if (!name || name.length > 255) {
      return NextResponse.json({ error: 'Name is required (max 255 chars)' }, { status: 400 });
    }

    const filterJson: TargetListFilterJson =
      o.filterJson !== undefined
        ? parseTargetListFilterJson(o.filterJson)
        : (existing.filterJson as TargetListFilterJson);
    let memberIds: string[];
    if (o.memberIds !== undefined) {
      const norm = normalizeMemberIds(o.memberIds);
      if (norm === null) {
        return NextResponse.json({ error: 'memberIds must be an array of UUID strings' }, { status: 400 });
      }
      memberIds = norm;
    } else {
      memberIds = [...(existing.memberIds ?? [])];
    }

    let excludedIds: string[];
    if (o.excludedIds !== undefined) {
      const ex = normalizeExcludedIds(o.excludedIds);
      if (ex === null) {
        return NextResponse.json({ error: 'excludedIds must be an array of UUID strings' }, { status: 400 });
      }
      excludedIds = ex;
    } else {
      excludedIds = [...(existing.excludedIds ?? [])];
    }

    const v = validateTargetListPayload({ filterJson, memberIds });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    if (!(await assertAllEndUsersExist([...memberIds, ...excludedIds]))) {
      return NextResponse.json(
        { error: 'One or more member or excluded ids do not exist' },
        { status: 400 }
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(targetLists)
      .set({
        name,
        filterJson,
        memberIds,
        excludedIds,
        updatedAt: now,
      })
      .where(eq(targetLists.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    await publishRedirectUpdatesForList(id);

    return NextResponse.json(serializeTargetListRow(updated));
  } catch (e) {
    console.error('[api/target-lists/[id] PUT]', e);
    return NextResponse.json({ error: 'Failed to update target list' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const s = await getSessionWithRole();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (s.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const [existing] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const redirectCampaignIds = await fetchRedirectCampaignIdsForList(id);
    await db.delete(targetLists).where(eq(targetLists.id, id));

    for (const campaignId of redirectCampaignIds) {
      await publishCampaignUpdated(campaignId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[api/target-lists/[id] DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete target list' }, { status: 500 });
  }
}
