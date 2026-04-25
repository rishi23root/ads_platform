import 'server-only';

import { database as db } from '@/db';
import { campaigns, endUsers, enduserEvents } from '@/db/schema';
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { getQueryParam } from '@/lib/url-search-params';
import { escapeCsvCell, escapeIlikePattern } from '@/lib/utils';

export type EventsDashboardFilters = {
  type?: (typeof enduserEvents.$inferSelect)['type'];
  from?: string;
  to?: string;
  domain?: string;
  country?: string;
  endUserId?: string;
  /**
   * Exact match on `enduser_events.user_identifier`.
   * When this is an end-user row UUID, callers should run `resolveEventsDashboardFilters` first.
   */
  endUserIdExact?: string;
  email?: string;
  campaignId?: string;
};

const EVENT_TYPES = new Set<string>([
  'ad',
  'notification',
  'popup',
  'redirect',
  'visit',
]);

/** Served campaign impressions (campaign-linked KPI; excludes visits). */
export const DASHBOARD_SERVED_EVENT_TYPES = ['ad', 'popup', 'notification', 'redirect'] as const;

/** Extension events chart: served types plus visits. */
export const DASHBOARD_CHART_EVENT_TYPES = [...DASHBOARD_SERVED_EVENT_TYPES, 'visit'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEventsDashboardFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): EventsDashboardFilters {
  const typeRaw = getQueryParam(sp, 'type')?.toLowerCase();
  const type =
    typeRaw && EVENT_TYPES.has(typeRaw)
      ? (typeRaw as EventsDashboardFilters['type'])
      : undefined;
  const country = getQueryParam(sp, 'country')?.trim().toUpperCase();
  return {
    type,
    from: getQueryParam(sp, 'from'),
    to: getQueryParam(sp, 'to'),
    domain: getQueryParam(sp, 'domain'),
    country: country && country.length === 2 ? country : undefined,
    endUserId: getQueryParam(sp, 'endUserId'),
    endUserIdExact: getQueryParam(sp, 'endUserIdExact'),
    email: getQueryParam(sp, 'email'),
    campaignId: getQueryParam(sp, 'campaignId'),
  };
}

/** INNER JOIN condition: events whose campaign is owned by this dashboard user. */
export function endEventsOwnedCampaignJoin(userId: string) {
  return and(eq(campaigns.id, enduserEvents.campaignId), eq(campaigns.createdBy, userId));
}

/**
 * Non-admins only see `enduser_events` rows tied to campaigns they created
 * (filters out unrelated campaigns and unscoped rows with no `campaign_id`).
 */
export function endEventsRequiresCampaignOwnerJoin(role: 'user' | 'admin'): boolean {
  return role === 'user';
}

/** When `admin`, no extra filter. When `user`, only events for campaigns `createdBy` this staff user. */
export function eventsAccessScopeForRole(
  role: 'user' | 'admin',
  userId: string
): SQL | undefined {
  if (role === 'admin') return undefined;
  return and(
    isNotNull(enduserEvents.campaignId),
    inArray(
      enduserEvents.campaignId,
      db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.createdBy, userId))
    )
  );
}

async function uuidToUserIdentifier(uuid: string): Promise<string | undefined> {
  const [row] = await db
    .select({ identifier: endUsers.identifier })
    .from(endUsers)
    .where(eq(endUsers.id, uuid))
    .limit(1);
  return row?.identifier;
}

/**
 * When `endUserIdExact` is a row UUID, resolves to `end_users.identifier`.
 * Returns `impossible: true` if the UUID does not match any end user (caller should return empty).
 */
export async function resolveEventsDashboardFilters(
  filters: EventsDashboardFilters
): Promise<{ filters: EventsDashboardFilters; impossible: boolean }> {
  const exact = filters.endUserIdExact?.trim();
  if (exact && UUID_RE.test(exact)) {
    const ident = await uuidToUserIdentifier(exact);
    if (!ident) return { filters, impossible: true };
    return { filters: { ...filters, endUserIdExact: ident }, impossible: false };
  }
  return { filters, impossible: false };
}

function buildFilterConditions(filters: EventsDashboardFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.type) {
    conditions.push(eq(enduserEvents.type, filters.type));
  }
  if (filters.from) {
    conditions.push(gte(enduserEvents.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    const end = new Date(filters.to);
    if (!filters.to.includes('T')) end.setHours(23, 59, 59, 999);
    conditions.push(lte(enduserEvents.createdAt, end));
  }
  if (filters.domain?.trim()) {
    const esc = escapeIlikePattern(filters.domain.trim());
    conditions.push(ilike(enduserEvents.domain, `%${esc}%`));
  }
  if (filters.country) {
    const cc = filters.country.toLowerCase();
    conditions.push(sql`lower(coalesce(${enduserEvents.country}, '')) = ${cc}`);
  }
  const exactUserIdent = filters.endUserIdExact?.trim();
  if (exactUserIdent) {
    conditions.push(eq(enduserEvents.userIdentifier, exactUserIdent));
  } else if (filters.endUserId?.trim()) {
    const esc = escapeIlikePattern(filters.endUserId.trim());
    conditions.push(ilike(enduserEvents.userIdentifier, `%${esc}%`));
  }
  if (filters.email?.trim()) {
    const esc = escapeIlikePattern(filters.email.trim());
    const matchingIds = db
      .select({ userIdentifier: endUsers.identifier })
      .from(endUsers)
      .where(ilike(endUsers.email, `%${esc}%`));
    conditions.push(inArray(enduserEvents.userIdentifier, matchingIds));
  }
  const cid = filters.campaignId?.trim();
  if (cid && UUID_RE.test(cid)) {
    conditions.push(eq(enduserEvents.campaignId, cid));
  }
  return conditions;
}

function filterWhereClause(
  filters: EventsDashboardFilters,
  role: 'user' | 'admin',
  userId: string
): SQL | undefined {
  const filtersList = buildFilterConditions(filters);
  const scope = eventsAccessScopeForRole(role, userId);
  if (scope) filtersList.push(scope);
  return filtersList.length ? and(...filtersList) : undefined;
}

export type EventStatsRow = {
  total: number;
  uniqueUsers: number;
  ad: number;
  popup: number;
  notification: number;
  redirect: number;
  visit: number;
};

export async function aggregateEventStats(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters
): Promise<EventStatsRow | undefined> {
  const { filters: f, impossible } = await resolveEventsDashboardFilters(filters);
  if (impossible) {
    return {
      total: 0,
      uniqueUsers: 0,
      ad: 0,
      popup: 0,
      notification: 0,
      redirect: 0,
      visit: 0,
    };
  }
  const fw = filterWhereClause(f, role, userId);
  const base = db
    .select({
      total: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${enduserEvents.userIdentifier})::int`,
      ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
      popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
      notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
      visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);

  const rows = fw ? await base.where(fw) : await base;
  return rows[0] as EventStatsRow | undefined;
}

export async function countEvents(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters
): Promise<number> {
  const { filters: f, impossible } = await resolveEventsDashboardFilters(filters);
  if (impossible) return 0;
  const fw = filterWhereClause(f, role, userId);
  const base = db.select({ count: sql<number>`count(*)::int` }).from(enduserEvents);
  const rows = fw ? await base.where(fw) : await base;
  return Number(rows[0]?.count ?? 0);
}

export type EventLogRow = {
  id: string;
  userIdentifier: string;
  endUserUuid: string | null;
  email: string | null;
  /** From `end_users` via join on `user_identifier` (not stored on the event row). */
  plan: 'trial' | 'paid' | null;
  campaignId: string | null;
  domain: string | null;
  type: string;
  country: string | null;
  userAgent: string | null;
  createdAt: Date;
};

const eventLogSelect = {
  id: enduserEvents.id,
  userIdentifier: enduserEvents.userIdentifier,
  endUserUuid: endUsers.id,
  email: endUsers.email,
  plan: endUsers.plan,
  campaignId: enduserEvents.campaignId,
  domain: enduserEvents.domain,
  type: enduserEvents.type,
  country: enduserEvents.country,
  userAgent: enduserEvents.userAgent,
  createdAt: enduserEvents.createdAt,
};

export async function listEventsPage(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters,
  opts: { limit: number; offset: number }
): Promise<EventLogRow[]> {
  const { filters: f, impossible } = await resolveEventsDashboardFilters(filters);
  if (impossible) return [];
  const fw = filterWhereClause(f, role, userId);
  const base = db
    .select(eventLogSelect)
    .from(enduserEvents)
    .leftJoin(endUsers, eq(endUsers.identifier, enduserEvents.userIdentifier));
  const filtered = fw ? base.where(fw) : base;
  return (await filtered
    .orderBy(desc(enduserEvents.createdAt))
    .limit(opts.limit)
    .offset(opts.offset)) as EventLogRow[];
}

/**
 * Combined pagination + total count in a single query using `count(*) OVER()`.
 * Resolves filters once internally, eliminating the separate countEvents round-trip.
 */
export async function listEventsPageWithCount(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters,
  opts: { limit: number; offset: number }
): Promise<{ rows: EventLogRow[]; totalCount: number }> {
  const { filters: f, impossible } = await resolveEventsDashboardFilters(filters);
  if (impossible) return { rows: [], totalCount: 0 };

  const fw = filterWhereClause(f, role, userId);

  const base = db
    .select({
      ...eventLogSelect,
      totalCount: sql<number>`count(*) over()::int`,
    })
    .from(enduserEvents)
    .leftJoin(endUsers, eq(endUsers.identifier, enduserEvents.userIdentifier));

  const filtered = fw ? base.where(fw) : base;
  const rawRows = await filtered
    .orderBy(desc(enduserEvents.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);

  const totalCount = rawRows[0]?.totalCount ?? 0;
  const rows = rawRows.map(({ totalCount, ...row }) => {
    void totalCount;
    return row;
  }) as EventLogRow[];
  return { rows, totalCount };
}

export async function listEventsForExport(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters
): Promise<EventLogRow[]> {
  const { filters: f, impossible } = await resolveEventsDashboardFilters(filters);
  if (impossible) return [];
  const fw = filterWhereClause(f, role, userId);
  const base = db
    .select(eventLogSelect)
    .from(enduserEvents)
    .leftJoin(endUsers, eq(endUsers.identifier, enduserEvents.userIdentifier));
  const filtered = fw ? base.where(fw) : base;
  return (await filtered.orderBy(desc(enduserEvents.createdAt))) as EventLogRow[];
}

/** URL params for pagination / export. */
export function eventsFilterParamsRecord(filters: EventsDashboardFilters): Record<string, string> {
  const o: Record<string, string> = {};
  if (filters.type) o.type = filters.type;
  if (filters.from) o.from = filters.from;
  if (filters.to) o.to = filters.to;
  if (filters.domain) o.domain = filters.domain;
  if (filters.country) o.country = filters.country;
  if (filters.endUserId) o.endUserId = filters.endUserId;
  if (filters.endUserIdExact) o.endUserIdExact = filters.endUserIdExact;
  if (filters.email) o.email = filters.email;
  if (filters.campaignId) o.campaignId = filters.campaignId;
  return o;
}

export type EventsFilterChipDescriptor = {
  param:
    | 'type'
    | 'from'
    | 'to'
    | 'domain'
    | 'country'
    | 'endUserId'
    | 'endUserIdExact'
    | 'email'
    | 'campaignId';
  label: string;
  display: string;
};

function chipDateDisplay(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const prefix = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix) return prefix[1];
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return t.length > 36 ? `${t.slice(0, 33)}…` : t;
}

function chipTruncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Human-readable chips for the events UI (active filters bar). */
export function eventsFilterChips(filters: EventsDashboardFilters): EventsFilterChipDescriptor[] {
  const chips: EventsFilterChipDescriptor[] = [];
  if (filters.type) chips.push({ param: 'type', label: 'Type', display: filters.type });
  if (filters.from)
    chips.push({ param: 'from', label: 'From', display: chipDateDisplay(filters.from) });
  if (filters.to) chips.push({ param: 'to', label: 'To', display: chipDateDisplay(filters.to) });
  if (filters.domain)
    chips.push({ param: 'domain', label: 'Domain', display: chipTruncate(filters.domain, 40) });
  if (filters.country)
    chips.push({ param: 'country', label: 'Country', display: filters.country.toUpperCase() });
  if (filters.endUserId)
    chips.push({
      param: 'endUserId',
      label: 'End user',
      display: chipTruncate(filters.endUserId, 22),
    });
  if (filters.endUserIdExact)
    chips.push({
      param: 'endUserIdExact',
      label: 'End user (exact)',
      display: chipTruncate(filters.endUserIdExact, 22),
    });
  if (filters.email)
    chips.push({ param: 'email', label: 'Email', display: chipTruncate(filters.email, 32) });
  if (filters.campaignId)
    chips.push({
      param: 'campaignId',
      label: 'Campaign',
      display: chipTruncate(filters.campaignId, 16),
    });
  return chips;
}

export function eventsToCsvLines(rows: EventLogRow[]): string[] {
  const header = [
    'endUserId',
    'email',
    'plan',
    'campaignId',
    'domain',
    'type',
    'country',
    'userAgent',
    'createdAt',
  ];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.endUserUuid ?? '',
        r.email ?? '',
        r.plan ?? '',
        r.campaignId ?? '',
        r.domain ?? '',
        r.type,
        r.country ?? '',
        r.userAgent ?? '',
        r.createdAt.toISOString(),
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines;
}
