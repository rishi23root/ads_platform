import 'server-only';

import { database as db } from '@/db';
import { endUsers, enduserEvents, enduserSessions } from '@/db/schema';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { EndUserListRow } from '@/lib/end-users-dashboard';
import {
  isTargetListFilterEmpty,
  type TargetListFilterJson,
} from '@/lib/target-list-filter';
import {
  computeExtensionDaysLeft,
  computeTrialEndDateFromStart,
  formatExtensionDaysLeftCell,
} from '@/lib/extension-user-subscription';
import { escapeCsvCell } from '@/lib/utils';

const sessionStats = db
  .select({
    endUserId: enduserSessions.endUserId,
    lastSessionAt: sql<Date | null>`max(${enduserSessions.createdAt})`.as('last_session_at'),
  })
  .from(enduserSessions)
  .groupBy(enduserSessions.endUserId)
  .as('session_stats_tl');

const endUserSessionJoin = eq(endUsers.id, sessionStats.endUserId);

const impressionCountsSubquery = db
  .select({
    userIdentifier: enduserEvents.userIdentifier,
    impressionCount: sql<number>`count(*)::int`.as('impression_count'),
  })
  .from(enduserEvents)
  .groupBy(enduserEvents.userIdentifier)
  .as('impression_counts_tl');

export type TargetListMembersListInput = {
  id: string;
  memberIds: string[];
  excludedIds: string[];
  filterJson: unknown;
};

export type TargetListMemberTabSource = 'all' | 'explicit' | 'filter' | 'excluded';

export type TargetListMemberSourceKind = 'explicit' | 'filter' | 'both' | 'excluded';

export type TargetListMemberRow = EndUserListRow & { memberSource: TargetListMemberSourceKind };

/** SQL predicate for users matching the target list filter (false when filter empty). */
export function buildTargetListFilterWhereSql(filter: TargetListFilterJson): SQL {
  if (isTargetListFilterEmpty(filter)) return sql`false`;
  const f = filter!;
  const parts: SQL[] = [];
  if (f.plans && f.plans.length > 0) {
    parts.push(inArray(endUsers.plan, f.plans));
  }
  if (f.countries && f.countries.length > 0) {
    const cc = f.countries.map((c) => c.toUpperCase().slice(0, 2)).filter((c) => c.length === 2);
    if (cc.length) parts.push(inArray(endUsers.country, cc));
  }
  if (typeof f.banned === 'boolean') {
    parts.push(eq(endUsers.banned, f.banned));
  }
  if (f.createdAfter) {
    const d = new Date(f.createdAfter);
    if (!Number.isNaN(d.getTime())) parts.push(gte(endUsers.createdAt, d));
  }
  if (f.createdBefore) {
    const end = new Date(f.createdBefore);
    if (!Number.isNaN(end.getTime())) {
      if (!f.createdBefore.includes('T')) end.setHours(23, 59, 59, 999);
      parts.push(lte(endUsers.createdAt, end));
    }
  }
  if (parts.length === 0) return sql`false`;
  return and(...parts)!;
}

function notExcludedWhere(excludedIds: string[]): SQL | undefined {
  if (excludedIds.length === 0) return undefined;
  return notInArray(endUsers.id, excludedIds);
}

function inMembersWhere(memberIds: string[]): SQL {
  if (memberIds.length === 0) return sql`false`;
  return inArray(endUsers.id, memberIds);
}

function notInMembersWhere(memberIds: string[]): SQL | undefined {
  if (memberIds.length === 0) return undefined;
  return notInArray(endUsers.id, memberIds);
}

export function buildTargetListMemberWhere(
  list: TargetListMembersListInput,
  source: TargetListMemberTabSource
): SQL | undefined {
  const filter = list.filterJson as TargetListFilterJson;
  const filterSql = buildTargetListFilterWhereSql(filter);
  const ex = notExcludedWhere(list.excludedIds);

  if (source === 'excluded') {
    if (list.excludedIds.length === 0) return sql`false`;
    const w = inArray(endUsers.id, list.excludedIds);
    return w;
  }

  if (source === 'explicit') {
    if (list.memberIds.length === 0) return sql`false`;
    const w = and(inMembersWhere(list.memberIds), ex);
    return w ?? inMembersWhere(list.memberIds);
  }

  if (source === 'filter') {
    const notMem = notInMembersWhere(list.memberIds);
    const parts: SQL[] = [filterSql];
    if (ex) parts.push(ex);
    if (notMem) parts.push(notMem);
    return and(...parts)!;
  }

  // all
  const inMem = inMembersWhere(list.memberIds);
  const qual = or(inMem, filterSql)!;
  if (ex) return and(qual, ex);
  return qual;
}

function memberSourceSelect(list: TargetListMembersListInput, source: TargetListMemberTabSource) {
  const filter = list.filterJson as TargetListFilterJson;
  const filterSql = buildTargetListFilterWhereSql(filter);
  const inMem = inMembersWhere(list.memberIds);

  if (source === 'excluded') {
    return sql`'excluded'`.as('member_source');
  }
  if (source === 'filter') {
    return sql`'filter'`.as('member_source');
  }
  if (source === 'explicit') {
    return sql`
      CASE
        WHEN (${filterSql}) THEN 'both'
        ELSE 'explicit'
      END
    `.as('member_source');
  }
  return sql`
    CASE
      WHEN (${inMem}) AND (${filterSql}) THEN 'both'
      WHEN (${inMem}) THEN 'explicit'
      ELSE 'filter'
    END
  `.as('member_source');
}

const listOrderBy = desc(sql`coalesce(${sessionStats.lastSessionAt}, ${endUsers.createdAt})`);

/** Max rows returned by CSV export (single query). */
export const TARGET_LIST_MEMBERS_EXPORT_MAX = 50_000;

async function queryTargetListMembersPage(
  list: TargetListMembersListInput,
  source: TargetListMemberTabSource,
  limit: number,
  offset: number
): Promise<TargetListMemberRow[]> {
  const whereClause = buildTargetListMemberWhere(list, source);
  const sourceCol = memberSourceSelect(list, source);

  let q = db
    .select({
      id: sql<string>`${endUsers.id}::text`.as('id'),
      email: endUsers.email,
      identifier: endUsers.identifier,
      name: endUsers.name,
      plan: endUsers.plan,
      banned: endUsers.banned,
      country: endUsers.country,
      startDate: endUsers.startDate,
      endDate: endUsers.endDate,
      createdAt: endUsers.createdAt,
      lastSessionAt: sessionStats.lastSessionAt,
      impressionCount: sql<number>`coalesce(${impressionCountsSubquery.impressionCount}, 0)`,
      memberSource: sourceCol,
    })
    .from(endUsers)
    .leftJoin(sessionStats, endUserSessionJoin)
    .leftJoin(impressionCountsSubquery, eq(endUsers.identifier, impressionCountsSubquery.userIdentifier))
    .$dynamic();

  if (whereClause) q = q.where(whereClause);
  const rows = await q.orderBy(listOrderBy).limit(limit).offset(offset);

  return rows.map((r) => ({
    ...r,
    impressionCount: Number(r.impressionCount ?? 0),
    memberSource: r.memberSource as TargetListMemberSourceKind,
  })) as TargetListMemberRow[];
}

export async function listTargetListMembers(
  list: TargetListMembersListInput,
  opts: { source: TargetListMemberTabSource; page: number; pageSize: number }
): Promise<TargetListMemberRow[]> {
  const page = Math.max(1, opts.page);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize));
  const offset = (page - 1) * pageSize;
  return queryTargetListMembersPage(list, opts.source, pageSize, offset);
}

/** Full tab export (admin CSV). Capped at {@link TARGET_LIST_MEMBERS_EXPORT_MAX}. */
export async function listTargetListMembersForExport(
  list: TargetListMembersListInput,
  source: TargetListMemberTabSource
): Promise<TargetListMemberRow[]> {
  return queryTargetListMembersPage(list, source, TARGET_LIST_MEMBERS_EXPORT_MAX, 0);
}

export function targetListMembersToCsvLines(rows: TargetListMemberRow[]): string[] {
  const header = [
    'UUID',
    'Identifier',
    'Email',
    'Name',
    'Impressions',
    'Plan',
    'Member source',
    'Banned',
    'Country',
    'Days left',
    'Start date',
    'End date',
    'Last session',
    'Created',
  ];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    const plan = row.plan === 'paid' ? 'paid' : 'trial';
    const daysLeft = formatExtensionDaysLeftCell(
      computeExtensionDaysLeft({
        endDate: row.endDate,
        plan,
        startDate: row.startDate,
      })
    );
    const effectiveEnd =
      row.endDate != null
        ? new Date(row.endDate)
        : plan === 'trial'
          ? computeTrialEndDateFromStart(row.startDate)
          : null;
    const cells: string[] = [
      row.id,
      row.identifier ?? '',
      row.email ?? '',
      row.name ?? '',
      String(row.impressionCount),
      row.plan,
      row.memberSource,
      row.banned ? 'true' : 'false',
      row.country ?? '',
      daysLeft === '—' ? '' : daysLeft,
      new Date(row.startDate).toISOString(),
      effectiveEnd ? effectiveEnd.toISOString() : '',
      row.lastSessionAt ? new Date(row.lastSessionAt).toISOString() : '',
      new Date(row.createdAt).toISOString(),
    ];
    lines.push(cells.map(escapeCsvCell).join(','));
  }
  return lines;
}

export async function countTargetListMembers(
  list: TargetListMembersListInput,
  source: TargetListMemberTabSource
): Promise<number> {
  const whereClause = buildTargetListMemberWhere(list, source);
  let q = db
    .select({ n: sql<number>`count(${endUsers.id})::int`.as('n') })
    .from(endUsers)
    .$dynamic();
  if (whereClause) q = q.where(whereClause);
  const rows = await q;
  return Number(rows[0]?.n ?? 0);
}

export async function countTargetListMembersByTab(
  list: TargetListMembersListInput
): Promise<{ all: number; explicit: number; filter: number; excluded: number }> {
  const [all, explicit, filter, excluded] = await Promise.all([
    countTargetListMembers(list, 'all'),
    countTargetListMembers(list, 'explicit'),
    countTargetListMembers(list, 'filter'),
    countTargetListMembers(list, 'excluded'),
  ]);
  return { all, explicit, filter, excluded };
}

export type TargetListMemberPlanBreakdown = { trial: number; paid: number };

export type TargetListMemberCountryBreakdown = { country: string; count: number }[];

/** Plan and top countries for qualifying members (same as `all` tab, excluding excluded). */
export async function aggregateTargetListMemberBreakdown(
  list: TargetListMembersListInput
): Promise<{ plans: TargetListMemberPlanBreakdown; topCountries: TargetListMemberCountryBreakdown }> {
  const whereClause = buildTargetListMemberWhere(list, 'all')!;

  const planRows = await db
    .select({
      plan: endUsers.plan,
      n: sql<number>`count(*)::int`.as('n'),
    })
    .from(endUsers)
    .where(whereClause)
    .groupBy(endUsers.plan);

  let trial = 0;
  let paid = 0;
  for (const r of planRows) {
    const n = Number(r.n ?? 0);
    if (r.plan === 'paid') paid += n;
    else trial += n;
  }

  const countryRows = await db
    .select({
      country: endUsers.country,
      n: sql<number>`count(*)::int`.as('n'),
    })
    .from(endUsers)
    .where(and(whereClause, isNotNull(endUsers.country))!)
    .groupBy(endUsers.country)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const topCountries = countryRows
    .map((r) => ({
      country: r.country as string,
      count: Number(r.n ?? 0),
    }))
    .filter((r) => r.country);

  return { plans: { trial, paid }, topCountries };
}
