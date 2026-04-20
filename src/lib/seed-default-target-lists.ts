import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { targetLists } from '@/db/schema';
import type { TargetListFilterJson } from '@/lib/target-list-filter';

/**
 * Built-in filter-only lists created on first seed. "All users" uses both plan
 * values because `end_users.plan` is only `trial` | `paid` — empty filters match
 * nobody in this app.
 */
export const DEFAULT_TARGET_LIST_PRESETS: ReadonlyArray<{
  name: string;
  filterJson: NonNullable<TargetListFilterJson>;
}> = [
  { name: 'All users', filterJson: { plans: ['trial', 'paid'] } },
  { name: 'Paid users', filterJson: { plans: ['paid'] } },
  { name: 'Trial users', filterJson: { plans: ['trial'] } },
];

/**
 * Idempotent: inserts each preset by name if no row with that name exists.
 * @returns Names of lists that were inserted this run.
 */
export async function ensureDefaultTargetLists(
  db: PostgresJsDatabase<typeof schema>
): Promise<string[]> {
  const created: string[] = [];

  for (const preset of DEFAULT_TARGET_LIST_PRESETS) {
    const existing = await db
      .select({ id: targetLists.id })
      .from(targetLists)
      .where(eq(targetLists.name, preset.name))
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(targetLists).values({
      name: preset.name,
      filterJson: preset.filterJson,
      memberIds: [],
      excludedIds: [],
    });
    created.push(preset.name);
  }

  return created;
}
