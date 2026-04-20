import type { targetLists } from '@/db/schema';

export type TargetListRow = typeof targetLists.$inferSelect;

export function serializeTargetListRow(row: TargetListRow) {
  return {
    id: row.id,
    name: row.name,
    filterJson: row.filterJson,
    memberIds: [...(row.memberIds ?? [])],
    excludedIds: [...(row.excludedIds ?? [])],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
