import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { targetLists } from '@/db/schema';
import { utf8CsvDownloadResponse } from '@/lib/admin-csv-response';
import { getSessionWithRole } from '@/lib/dal';
import {
  countTargetListMembers,
  listTargetListMembersForExport,
  targetListMembersToCsvLines,
  TARGET_LIST_MEMBERS_EXPORT_MAX,
  type TargetListMemberTabSource,
} from '@/lib/target-list-members-query';

export const dynamic = 'force-dynamic';

function parseSource(sp: URLSearchParams): TargetListMemberTabSource {
  const r = sp.get('source');
  if (r === 'explicit' || r === 'filter' || r === 'excluded') return r;
  return 'all';
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (sessionWithRole.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const [row] = await db.select().from(targetLists).where(eq(targetLists.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const source = parseSource(new URL(request.url).searchParams);
  const listIn = {
    id: row.id,
    memberIds: [...(row.memberIds ?? [])],
    excludedIds: [...(row.excludedIds ?? [])],
    filterJson: row.filterJson,
  };

  const total = await countTargetListMembers(listIn, source);
  if (total > TARGET_LIST_MEMBERS_EXPORT_MAX) {
    return NextResponse.json(
      {
        error: `This tab has ${total.toLocaleString()} members; exports are limited to ${TARGET_LIST_MEMBERS_EXPORT_MAX.toLocaleString()} rows. Narrow the audience or export per segment.`,
      },
      { status: 413 }
    );
  }

  const members = await listTargetListMembersForExport(listIn, source);
  const lines = targetListMembersToCsvLines(members);
  const safeName = row.name.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 64) || 'list';
  return utf8CsvDownloadResponse(lines, `audience-${safeName}-${source}`);
}
