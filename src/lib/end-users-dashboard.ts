import 'server-only';

import { database as db } from '@/db';
import { endUsers, enduserEvents, enduserSessions } from '@/db/schema';
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { getCountryName } from '@/lib/countries';
import { computeExtensionDaysLeft, formatExtensionDaysLeftCell } from '@/lib/extension-user-subscription';
import { getQueryParam } from '@/lib/url-search-params';
import { escapeCsvCell, escapeIlikePattern } from '@/lib/utils';

export type EndUsersDashboardFilters = {
  q?: string;
  /** Toolbar / quick search: partial match on email only (distinct from multi-field `q`). */
  email?: string;
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
    email: getQueryParam(sp, 'email'),
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

/** Text equality so `end_users.id` (uuid) joins legacy `end_user_id` stored as varchar. */
const endUserSessionJoin = sql`cast(${endUsers.id} as text) = cast(${sessionStats.endUserId} as text)`;

/** Shared filter predicates (same join keys as list query). */
function buildEndUsersWhereConditions(filters: EndUsersDashboardFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.email?.trim()) {
    const escaped = escapeIlikePattern(filters.email.trim());
    conditions.push(ilike(endUsers.email, `%${escaped}%`));
  }

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
    if (!Number.isNaN(d.getTime())) {
      conditions.push(
        sql`coalesce(${sessionStats.lastSessionAt}, ${endUsers.createdAt}) >= ${d.toISOString()}`
      );
    }
  }
  if (filters.lastSeenTo) {
    const end = new Date(filters.lastSeenTo);
    if (!Number.isNaN(end.getTime())) {
      if (!filters.lastSeenTo.includes('T')) end.setHours(23, 59, 59, 999);
      conditions.push(
        sql`coalesce(${sessionStats.lastSessionAt}, ${endUsers.createdAt}) <= ${end.toISOString()}`
      );
    }
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

export type UsersFilterChipDescriptor = {
  id: string;
  /** Query keys to remove when clearing this chip (e.g. search clears both `q` and `endUserId`). */
  urlKeys: string[];
  label: string;
  display: string;
};

function usersChipTruncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function usersChipDateTimeDisplay(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }
  return usersChipTruncate(t, 42);
}

/** Active-filter chips for the users list (matches URL + `parseEndUsersDashboardFilters`). */
export function usersFilterChips(
  filters: EndUsersDashboardFilters,
  urlFlags: { hasQParam: boolean; hasEndUserIdParam: boolean }
): UsersFilterChipDescriptor[] {
  const chips: UsersFilterChipDescriptor[] = [];
  if (filters.email?.trim()) {
    chips.push({
      id: 'email',
      urlKeys: ['email'],
      label: 'Email',
      display: usersChipTruncate(filters.email.trim(), 36),
    });
  }
  if (filters.q?.trim()) {
    const label =
      urlFlags.hasEndUserIdParam && !urlFlags.hasQParam ? 'End user' : 'Search';
    chips.push({
      id: 'search',
      urlKeys: ['q', 'endUserId'],
      label,
      display: usersChipTruncate(filters.q.trim(), 36),
    });
  }
  if (filters.joinedFrom)
    chips.push({
      id: 'joinedFrom',
      urlKeys: ['joinedFrom'],
      label: 'Joined from',
      display: usersChipDateTimeDisplay(filters.joinedFrom),
    });
  if (filters.joinedTo)
    chips.push({
      id: 'joinedTo',
      urlKeys: ['joinedTo'],
      label: 'Joined to',
      display: usersChipDateTimeDisplay(filters.joinedTo),
    });
  if (filters.lastSeenFrom)
    chips.push({
      id: 'lastSeenFrom',
      urlKeys: ['lastSeenFrom'],
      label: 'Last session from',
      display: usersChipDateTimeDisplay(filters.lastSeenFrom),
    });
  if (filters.lastSeenTo)
    chips.push({
      id: 'lastSeenTo',
      urlKeys: ['lastSeenTo'],
      label: 'Last session to',
      display: usersChipDateTimeDisplay(filters.lastSeenTo),
    });
  if (filters.country) {
    const cc = filters.country.toUpperCase().slice(0, 2);
    const name = getCountryName(cc);
    chips.push({
      id: 'country',
      urlKeys: ['country'],
      label: 'Country',
      display: name && name !== cc ? `${cc} · ${name}` : cc,
    });
  }
  if (filters.plan)
    chips.push({
      id: 'plan',
      urlKeys: ['plan'],
      label: 'Plan',
      display: filters.plan === 'paid' ? 'Paid' : 'Trial',
    });
  if (filters.status)
    chips.push({
      id: 'status',
      urlKeys: ['status'],
      label: 'Status',
      display: filters.status.charAt(0).toUpperCase() + filters.status.slice(1),
    });
  return chips;
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
  /** All `enduser_events` rows for this user (`enduser_id` or matching email). */
  impressionCount: number;
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
      impressionCount: sql<number>`(
        select count(*)::int
        from ${enduserEvents}
        where cast(${enduserEvents.endUserId} as text) = cast(${endUsers.id} as text)
        or (
          ${endUsers.email} is not null
          and ${enduserEvents.email} is not null
          and lower(${enduserEvents.email}) = lower(${endUsers.email})
        )
      )`.as('impression_count'),
    })
    .from(endUsers)
    .leftJoin(sessionStats, endUserSessionJoin)
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
  const rows = await q;
  return rows.map((r) => ({
    ...r,
    impressionCount: Number(r.impressionCount ?? 0),
  })) as EndUserListRow[];
}

export async function countEndUsersListQuery(
  filters: EndUsersDashboardFilters
): Promise<number> {
  const conditions = buildEndUsersWhereConditions(filters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let q = db
    .select({ n: sql<number>`count(${endUsers.id})::int`.as('n') })
    .from(endUsers)
    .leftJoin(sessionStats, endUserSessionJoin)
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
    'Impressions',
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
      String(row.impressionCount),
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
