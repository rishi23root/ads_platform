import { endUsers } from '@/db/schema';
import { database as db } from '@/db';
import { inArray } from 'drizzle-orm';
import {
  isTargetListFilterEmpty,
  type TargetListFilterJson,
} from '@/lib/target-list-filter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTargetListFilterJson(raw: unknown): TargetListFilterJson {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: NonNullable<TargetListFilterJson> = {};

  if (Array.isArray(o.plans)) {
    const plans = o.plans.filter((p): p is 'trial' | 'paid' => p === 'trial' || p === 'paid');
    if (plans.length) out.plans = plans;
  }
  if (Array.isArray(o.countries)) {
    const countries = o.countries
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.toUpperCase().slice(0, 2))
      .filter((c) => c.length === 2);
    if (countries.length) out.countries = countries;
  }
  if (typeof o.banned === 'boolean') out.banned = o.banned;
  if (typeof o.createdAfter === 'string' && o.createdAfter.trim()) out.createdAfter = o.createdAfter.trim();
  if (typeof o.createdBefore === 'string' && o.createdBefore.trim())
    out.createdBefore = o.createdBefore.trim();

  if (isTargetListFilterEmpty(out)) return null;
  return out;
}

export function normalizeMemberIds(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const ids: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string' || !UUID_RE.test(x)) return null;
    ids.push(x.toLowerCase());
  }
  return [...new Set(ids)];
}

/** Same validation as `normalizeMemberIds`; used for `excluded_ids`. */
export function normalizeExcludedIds(raw: unknown): string[] | null {
  return normalizeMemberIds(raw);
}

export async function assertAllEndUsersExist(memberIds: string[]): Promise<boolean> {
  const unique = [...new Set(memberIds)];
  if (unique.length === 0) return true;
  const rows = await db
    .select({ id: endUsers.id })
    .from(endUsers)
    .where(inArray(endUsers.id, unique));
  return rows.length === unique.length;
}

export function validateTargetListPayload(params: {
  filterJson: TargetListFilterJson;
  memberIds: string[];
}): { ok: true } | { ok: false; error: string } {
  if (isTargetListFilterEmpty(params.filterJson) && params.memberIds.length === 0) {
    return { ok: false, error: 'Target list must have a filter or at least one member' };
  }
  return { ok: true };
}

export { UUID_RE };
