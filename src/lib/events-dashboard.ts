import 'server-only';

import { database as db } from '@/db';
import { campaigns, enduserEvents } from '@/db/schema';
import { and, desc, eq, gte, ilike, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
import { getQueryParam } from '@/lib/url-search-params';
import { escapeCsvCell, escapeIlikePattern } from '@/lib/utils';

export type EventsDashboardFilters = {
  type?: (typeof enduserEvents.$inferSelect)['type'];
  from?: string;
  to?: string;
  domain?: string;
  country?: string;
  endUserId?: string;
  email?: string;
  campaignId?: string;
};

const EVENT_TYPES = new Set<string>([
  'ad',
  'notification',
  'popup',
  'request',
  'redirect',
  'visit',
]);

/** Types counted on the main dashboard chart and “served” KPI (campaign-linked only). */
export const DASHBOARD_SERVED_EVENT_TYPES = ['ad', 'popup', 'notification'] as const;

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
    email: getQueryParam(sp, 'email'),
    campaignId: getQueryParam(sp, 'campaignId'),
  };
}

/** INNER JOIN condition: events whose campaign is owned by this dashboard user. */
export function endEventsOwnedCampaignJoin(userId: string) {
  return and(eq(campaigns.id, enduserEvents.campaignId), eq(campaigns.createdBy, userId));
}

/** Non-admins must join campaigns this way instead of filtering with EXISTS. */
export function endEventsRequiresCampaignOwnerJoin(role: 'user' | 'admin'): boolean {
  return role !== 'admin';
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
  /** Domain / end-user substring search (same family as other dashboards). */
  if (filters.domain?.trim()) {
    const esc = escapeIlikePattern(filters.domain.trim());
    conditions.push(ilike(enduserEvents.domain, `%${esc}%`));
  }
  if (filters.country) {
    const cc = filters.country.toLowerCase();
    conditions.push(sql`lower(coalesce(${enduserEvents.country}, '')) = ${cc}`);
  }
  if (filters.endUserId?.trim()) {
    const esc = escapeIlikePattern(filters.endUserId.trim());
    conditions.push(ilike(enduserEvents.endUserId, `%${esc}%`));
  }
  if (filters.email?.trim()) {
    const esc = escapeIlikePattern(filters.email.trim());
    conditions.push(ilike(enduserEvents.email, `%${esc}%`));
  }
  const cid = filters.campaignId?.trim();
  if (cid && UUID_RE.test(cid)) {
    conditions.push(eq(enduserEvents.campaignId, cid));
  }
  return conditions;
}

function filterWhereClause(filters: EventsDashboardFilters): SQL | undefined {
  const filtersList = buildFilterConditions(filters);
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
  request: number;
};

export async function aggregateEventStats(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters
): Promise<EventStatsRow | undefined> {
  const fw = filterWhereClause(filters);
  const base = db
    .select({
      total: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${enduserEvents.endUserId})::int`,
      ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
      popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
      notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
      visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      request: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'request' then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);

  const scoped =
    role === 'admin' ? base : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(userId));
  const rows = fw ? await scoped.where(fw) : await scoped;
  return rows[0] as EventStatsRow | undefined;
}

export async function countEvents(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters
): Promise<number> {
  const fw = filterWhereClause(filters);
  const base = db.select({ count: sql<number>`count(*)::int` }).from(enduserEvents);
  const scoped =
    role === 'admin' ? base : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(userId));
  const rows = fw ? await scoped.where(fw) : await scoped;
  return Number(rows[0]?.count ?? 0);
}

export type EventLogRow = {
  id: string;
  endUserId: string;
  email: string | null;
  campaignId: string | null;
  domain: string | null;
  type: string;
  country: string | null;
  userAgent: string | null;
  statusCode: number | null;
  createdAt: Date;
};

export async function listEventsPage(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters,
  opts: { limit: number; offset: number }
): Promise<EventLogRow[]> {
  const fw = filterWhereClause(filters);
  const base = db
    .select({
      id: enduserEvents.id,
      endUserId: enduserEvents.endUserId,
      email: enduserEvents.email,
      campaignId: enduserEvents.campaignId,
      domain: enduserEvents.domain,
      type: enduserEvents.type,
      country: enduserEvents.country,
      userAgent: enduserEvents.userAgent,
      statusCode: enduserEvents.statusCode,
      createdAt: enduserEvents.createdAt,
    })
    .from(enduserEvents);
  const scoped =
    role === 'admin' ? base : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(userId));
  const filtered = fw ? scoped.where(fw) : scoped;
  return (await filtered
    .orderBy(desc(enduserEvents.createdAt))
    .limit(opts.limit)
    .offset(opts.offset)) as EventLogRow[];
}

export async function listEventsForExport(
  role: 'user' | 'admin',
  userId: string,
  filters: EventsDashboardFilters
): Promise<EventLogRow[]> {
  const fw = filterWhereClause(filters);
  const base = db
    .select({
      id: enduserEvents.id,
      endUserId: enduserEvents.endUserId,
      email: enduserEvents.email,
      campaignId: enduserEvents.campaignId,
      domain: enduserEvents.domain,
      type: enduserEvents.type,
      country: enduserEvents.country,
      userAgent: enduserEvents.userAgent,
      statusCode: enduserEvents.statusCode,
      createdAt: enduserEvents.createdAt,
    })
    .from(enduserEvents);
  const scoped =
    role === 'admin' ? base : base.innerJoin(campaigns, endEventsOwnedCampaignJoin(userId));
  const filtered = fw ? scoped.where(fw) : scoped;
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
    'id',
    'endUserId',
    'email',
    'campaignId',
    'domain',
    'type',
    'country',
    'userAgent',
    'statusCode',
    'createdAt',
  ];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.endUserId,
        r.email ?? '',
        r.campaignId ?? '',
        r.domain ?? '',
        r.type,
        r.country ?? '',
        r.userAgent ?? '',
        r.statusCode != null ? String(r.statusCode) : '',
        r.createdAt.toISOString(),
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines;
}
