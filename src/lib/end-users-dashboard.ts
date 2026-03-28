import 'server-only';

import { database as db } from '@/db';
import { endUsers, enduserSessions } from '@/db/schema';
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { computeExtensionDaysLeft, formatExtensionDaysLeftCell } from '@/lib/extension-user-subscription';
import { getQueryParam } from '@/lib/url-search-params';
import { escapeCsvCell, escapeIlikePattern } from '@/lib/utils';

export type EndUsersDashboardFilters = {
  q?: string;
  joinedFrom?: string;
  joinedTo?: string;
  lastSeenFrom?: string;
  lastSeenTo?: string;
  country?: string;
  plan?: 'trial' | 'paid';
  status?: 'active' | 'suspended' | 'churned';
};

export function parseEndUsersDashboardFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): EndUsersDashboardFilters {
  const q = getQueryParam(sp, 'q');
  const endUserId = getQueryParam(sp, 'endUserId');
  const planRaw = getQueryParam(sp, 'plan')?.toLowerCase();
  const plan =
    planRaw === 'trial' || planRaw === 'paid' ? (planRaw as 'trial' | 'paid') : undefined;
  const statusRaw = getQueryParam(sp, 'status')?.toLowerCase();
  const status =
    statusRaw === 'active' || statusRaw === 'suspended' || statusRaw === 'churned'
      ? (statusRaw as 'active' | 'suspended' | 'churned')
      : undefined;
  return {
    q: q ?? endUserId,
    joinedFrom: getQueryParam(sp, 'joinedFrom'),
    joinedTo: getQueryParam(sp, 'joinedTo'),
    lastSeenFrom: getQueryParam(sp, 'lastSeenFrom'),
    lastSeenTo: getQueryParam(sp, 'lastSeenTo'),
    country: getQueryParam(sp, 'country'),
    plan,
    status,
  };
}

const sessionStats = db
  .select({
    endUserId: enduserSessions.endUserId,
    lastSessionAt: sql<Date | null>`max(${enduserSessions.createdAt})`.as('last_session_at'),
  })
  .from(enduserSessions)
  .groupBy(enduserSessions.endUserId)
  .as('session_stats');

/** Shared filter predicates (same join keys as list query). */
function buildEndUsersWhereConditions(filters: EndUsersDashboardFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.q) {
    const escaped = escapeIlikePattern(filters.q);
    const pattern = `%${escaped}%`;
    conditions.push(
      or(
        ilike(endUsers.email, pattern),
        ilike(endUsers.shortId, pattern),
        ilike(endUsers.installationId, pattern),
        ilike(sql`cast(${endUsers.id} as text)`, pattern),
        ilike(endUsers.name, pattern)
      )!
    );
  }

  if (filters.joinedFrom) {
    conditions.push(gte(endUsers.startDate, new Date(filters.joinedFrom)));
  }
  if (filters.joinedTo) {
    const end = new Date(filters.joinedTo);
    if (!filters.joinedTo.includes('T')) end.setHours(23, 59, 59, 999);
    conditions.push(lte(endUsers.startDate, end));
  }

  if (filters.lastSeenFrom) {
    const d = new Date(filters.lastSeenFrom);
    conditions.push(
      sql`coalesce(${sessionStats.lastSessionAt}, ${endUsers.createdAt}) >= ${d}`
    );
  }
  if (filters.lastSeenTo) {
    const end = new Date(filters.lastSeenTo);
    if (!filters.lastSeenTo.includes('T')) end.setHours(23, 59, 59, 999);
    conditions.push(
      sql`coalesce(${sessionStats.lastSessionAt}, ${endUsers.createdAt}) <= ${end}`
    );
  }

  if (filters.country) {
    conditions.push(eq(endUsers.country, filters.country.toUpperCase().slice(0, 2)));
  }

  if (filters.plan) {
    conditions.push(eq(endUsers.plan, filters.plan));
  }

  if (filters.status) {
    conditions.push(eq(endUsers.status, filters.status));
  }

  return conditions;
}

export type EndUserListRow = {
  id: string;
  email: string | null;
  shortId: string;
  installationId: string | null;
  name: string | null;
  plan: string;
  status: string;
  country: string | null;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  /** Latest session row created_at (extension auth), if any. */
  lastSessionAt: Date | null;
};

export function buildEndUsersListBaseQuery(
  filters: EndUsersDashboardFilters,
  options?: { omitOrderBy?: boolean }
) {
  const conditions = buildEndUsersWhereConditions(filters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let q = db
    .select({
      id: sql<string>`${endUsers.id}::text`.as('id'),
      email: endUsers.email,
      shortId: endUsers.shortId,
      installationId: endUsers.installationId,
      name: endUsers.name,
      plan: endUsers.plan,
      status: endUsers.status,
      country: endUsers.country,
      startDate: endUsers.startDate,
      endDate: endUsers.endDate,
      createdAt: endUsers.createdAt,
      lastSessionAt: sessionStats.lastSessionAt,
    })
    .from(endUsers)
    .leftJoin(sessionStats, eq(endUsers.id, sessionStats.endUserId))
    .$dynamic();

  if (whereClause) {
    q = q.where(whereClause);
  }

  if (options?.omitOrderBy) {
    return q;
  }

  return q.orderBy(
    desc(sql`coalesce(${sessionStats.lastSessionAt}, ${endUsers.createdAt})`)
  );
}

export async function runEndUsersListQuery(
  filters: EndUsersDashboardFilters,
  options?: { limit?: number; offset?: number }
): Promise<EndUserListRow[]> {
  let q = buildEndUsersListBaseQuery(filters);
  if (options?.limit !== undefined) {
    q = q.limit(options.limit).offset(options.offset ?? 0);
  }
  return (await q) as EndUserListRow[];
}

export async function countEndUsersListQuery(
  filters: EndUsersDashboardFilters
): Promise<number> {
  const conditions = buildEndUsersWhereConditions(filters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let q = db
    .select({ n: sql<number>`count(${endUsers.id})::int`.as('n') })
    .from(endUsers)
    .leftJoin(sessionStats, eq(endUsers.id, sessionStats.endUserId))
    .$dynamic();

  if (whereClause) {
    q = q.where(whereClause);
  }

  const rows = await q;
  return Number(rows[0]?.n ?? 0);
}

export function endUsersToCsvLines(rows: EndUserListRow[]): string[] {
  const header = [
    'UUID',
    'Short ID',
    'Installation ID',
    'Email',
    'Name',
    'Plan',
    'Status',
    'Country',
    'Days left',
    'Start date',
    'End date',
    'Last session',
    'Created',
  ];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    const daysLeft = formatExtensionDaysLeftCell(computeExtensionDaysLeft({ endDate: row.endDate }));
    const cells: string[] = [
      row.id,
      row.shortId,
      row.installationId ?? '',
      row.email ?? '',
      row.name ?? '',
      row.plan,
      row.status,
      row.country ?? '',
      daysLeft === '—' ? '' : daysLeft,
      new Date(row.startDate).toISOString(),
      row.endDate ? new Date(row.endDate).toISOString() : '',
      row.lastSessionAt ? new Date(row.lastSessionAt).toISOString() : '',
      new Date(row.createdAt).toISOString(),
    ];
    lines.push(cells.map(escapeCsvCell).join(','));
  }
  return lines;
}
