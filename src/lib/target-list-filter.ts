import type { EndUserRow } from '@/db/schema';

export type TargetListFilterJson = {
  plans?: Array<'trial' | 'paid'>;
  countries?: string[];
  banned?: boolean;
  createdAfter?: string;
  createdBefore?: string;
} | null;

export function isTargetListFilterEmpty(filter: TargetListFilterJson): boolean {
  if (!filter) return true;
  const hasAny =
    (filter.plans && filter.plans.length > 0) ||
    (filter.countries && filter.countries.length > 0) ||
    typeof filter.banned === 'boolean' ||
    Boolean(filter.createdAfter) ||
    Boolean(filter.createdBefore);
  return !hasAny;
}

export function summarizeFilter(f: TargetListFilterJson): string {
  if (isTargetListFilterEmpty(f)) return '—';
  const parts: string[] = [];
  if (f?.plans?.length) parts.push('plan=' + f.plans.join(','));
  if (f?.countries?.length) parts.push(f.countries.length + ' countries');
  if (typeof f?.banned === 'boolean') parts.push('banned=' + f.banned);
  if (f?.createdAfter) parts.push('after=' + f.createdAfter.slice(0, 10));
  if (f?.createdBefore) parts.push('before=' + f.createdBefore.slice(0, 10));
  return parts.join(' · ');
}

export function targetListFilterMatchesEndUser(
  filter: TargetListFilterJson,
  user: EndUserRow
): boolean {
  if (isTargetListFilterEmpty(filter)) return false;
  const f = filter!;
  if (f.plans && f.plans.length > 0 && !f.plans.includes(user.plan)) return false;
  if (f.countries && f.countries.length > 0) {
    const c = user.country?.toUpperCase();
    if (!c || !f.countries.map((x) => x.toUpperCase()).includes(c)) return false;
  }
  if (typeof f.banned === 'boolean' && user.banned !== f.banned) return false;
  if (f.createdAfter && new Date(user.createdAt) < new Date(f.createdAfter)) return false;
  if (f.createdBefore && new Date(user.createdAt) > new Date(f.createdBefore)) return false;
  return true;
}

export function endUserInTargetList(
  list: {
    id: string;
    memberIds: string[] | null;
    excludedIds?: string[] | null;
    filterJson: unknown;
  },
  user: EndUserRow
): boolean {
  const excludedIds = list.excludedIds ?? [];
  if (excludedIds.includes(user.id)) return false;
  const memberIds = list.memberIds ?? [];
  if (memberIds.includes(user.id)) return true;
  return targetListFilterMatchesEndUser(list.filterJson as TargetListFilterJson, user);
}
