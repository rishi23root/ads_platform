import 'server-only';

import { database as db } from '@/db';
import { campaigns, targetLists } from '@/db/schema';
import type { EndUserRow } from '@/db/schema';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { endUserInTargetList } from '@/lib/target-list-filter';

export type TargetListRow = {
  id: string;
  name: string;
  filterJson: unknown;
  memberIds: string[];
  excludedIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export async function fetchTargetListsByIds(ids: string[]): Promise<TargetListRow[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: targetLists.id,
      name: targetLists.name,
      filterJson: targetLists.filterJson,
      memberIds: targetLists.memberIds,
      excludedIds: targetLists.excludedIds,
      createdAt: targetLists.createdAt,
      updatedAt: targetLists.updatedAt,
    })
    .from(targetLists)
    .where(inArray(targetLists.id, ids));
  return rows.map((r) => ({
    ...r,
    memberIds: [...(r.memberIds ?? [])],
    excludedIds: [...(r.excludedIds ?? [])],
  }));
}

export async function computeTargetListMembershipForUser(
  candidateListIds: string[],
  user: EndUserRow
): Promise<Set<string>> {
  if (candidateListIds.length === 0) return new Set();
  const lists = await fetchTargetListsByIds(candidateListIds);
  const out = new Set<string>();
  for (const l of lists) {
    if (endUserInTargetList(l, user)) out.add(l.id);
  }
  return out;
}

export async function fetchCampaignCountByTargetList(): Promise<Record<string, number>> {
  const rows = await db
    .select({ id: campaigns.targetListId, count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(and(ne(campaigns.status, 'deleted'), sql`${campaigns.targetListId} is not null`))
    .groupBy(campaigns.targetListId);
  const map: Record<string, number> = {};
  for (const r of rows) if (r.id) map[r.id] = Number(r.count);
  return map;
}

export type TargetListLinkedCampaignRow = {
  id: string;
  name: string;
  status: (typeof campaigns.$inferSelect)['status'];
  campaignType: (typeof campaigns.$inferSelect)['campaignType'];
};

/** Non-deleted campaigns that reference this target list (any campaign type). */
export async function fetchCampaignsForTargetList(listId: string): Promise<TargetListLinkedCampaignRow[]> {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      campaignType: campaigns.campaignType,
    })
    .from(campaigns)
    .where(and(eq(campaigns.targetListId, listId), ne(campaigns.status, 'deleted')))
    .orderBy(asc(campaigns.name));
}

export async function fetchRedirectCampaignIdsForList(listId: string): Promise<string[]> {
  const rows = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.campaignType, 'redirect'), eq(campaigns.targetListId, listId)));
  return rows.map((r) => r.id);
}
