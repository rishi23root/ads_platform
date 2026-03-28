import 'server-only';

import { database as db } from '@/db';
import { endUsers, payments } from '@/db/schema';
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import type { PaymentListRow, PaymentStatusFilter, PaymentsDashboardFilters } from '@/lib/payments-types';
import { getQueryParam } from '@/lib/url-search-params';
import { escapeCsvCell, escapeIlikePattern } from '@/lib/utils';

export type { PaymentListRow, PaymentStatusFilter, PaymentsDashboardFilters } from '@/lib/payments-types';

export function parsePaymentsDashboardFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): PaymentsDashboardFilters {
  const q = getQueryParam(sp, 'q');
  const statusRaw = getQueryParam(sp, 'status')?.toLowerCase();
  const status =
    statusRaw === 'pending' ||
    statusRaw === 'completed' ||
    statusRaw === 'failed' ||
    statusRaw === 'refunded'
      ? (statusRaw as PaymentStatusFilter)
      : undefined;
  return { q, status };
}

function buildPaymentsFilterConditions(filters: PaymentsDashboardFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(payments.status, filters.status));
  }

  if (filters.q) {
    const escaped = escapeIlikePattern(filters.q);
    const pattern = `%${escaped}%`;
    conditions.push(
      or(
        ilike(sql`coalesce(${endUsers.email}, '')`, pattern),
        ilike(endUsers.shortId, pattern),
        ilike(sql`coalesce(${endUsers.installationId}, '')`, pattern),
        ilike(sql`coalesce(${endUsers.name}, '')`, pattern),
        ilike(sql`cast(${payments.id} as text)`, pattern)
      )!
    );
  }

  return conditions;
}

export async function runPaymentsListQuery(
  filters: PaymentsDashboardFilters,
  options: { limit: number; offset: number }
): Promise<PaymentListRow[]> {
  const conds = buildPaymentsFilterConditions(filters);
  const filterSql = conds.length > 0 ? and(...conds) : undefined;

  const base = db
    .select({
      id: payments.id,
      endUserId: payments.endUserId,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      description: payments.description,
      paymentDate: payments.paymentDate,
      createdAt: payments.createdAt,
      endUserEmail: endUsers.email,
      endUserName: endUsers.name,
    })
    .from(payments)
    .innerJoin(endUsers, eq(payments.endUserId, endUsers.id))
    .$dynamic();

  const rows = await base
    .where(filterSql)
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return rows;
}

export async function countPaymentsListQuery(filters: PaymentsDashboardFilters): Promise<number> {
  const conds = buildPaymentsFilterConditions(filters);
  const filterSql = conds.length > 0 ? and(...conds) : undefined;

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .innerJoin(endUsers, eq(payments.endUserId, endUsers.id))
    .where(filterSql);

  return row?.count ?? 0;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function startOfPriorMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
}

const completed = eq(payments.status, 'completed');

export type PaymentsSummary = {
  totalThisMonthCents: number;
  totalPriorMonthCents: number;
  totalEverCents: number;
  paidUsersCount: number;
  completedPaymentsThisMonthCount: number;
  completedPaymentsAllTimeCount: number;
  distinctPayersThisMonthCount: number;
};

export async function getPaymentsSummary(): Promise<PaymentsSummary> {
  const monthStart = startOfCurrentMonth();
  const priorMonthStart = startOfPriorMonth();

  const [
    [monthAgg],
    [priorAgg],
    [everAgg],
    [paidRow],
    [payersThisMonthRow],
  ] = await Promise.all([
    db
      .select({
        sum: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(and(completed, gte(payments.paymentDate, monthStart))),
    db
      .select({
        sum: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
      })
      .from(payments)
      .where(
        and(completed, gte(payments.paymentDate, priorMonthStart), lt(payments.paymentDate, monthStart))
      ),
    db
      .select({
        sum: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(completed),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(endUsers)
      .where(eq(endUsers.plan, 'paid')),
    db
      .select({
        count: sql<number>`count(distinct ${payments.endUserId})::int`,
      })
      .from(payments)
      .where(and(completed, gte(payments.paymentDate, monthStart))),
  ]);

  return {
    totalThisMonthCents: monthAgg?.sum ?? 0,
    totalPriorMonthCents: priorAgg?.sum ?? 0,
    totalEverCents: everAgg?.sum ?? 0,
    paidUsersCount: paidRow?.count ?? 0,
    completedPaymentsThisMonthCount: monthAgg?.count ?? 0,
    completedPaymentsAllTimeCount: everAgg?.count ?? 0,
    distinctPayersThisMonthCount: payersThisMonthRow?.count ?? 0,
  };
}

export function paymentsToCsvLines(rows: PaymentListRow[]): string[] {
  const header = [
    'Date',
    'User Email',
    'User Name',
    'Amount',
    'Currency',
    'Status',
    'Description',
  ].join(',');
  const lines = [header];
  for (const r of rows) {
    const dateIso = r.paymentDate.toISOString();
    const desc = r.description ?? '';
    const amountMajor = (r.amount / 100).toFixed(2);
    lines.push(
      [
        escapeCsvCell(dateIso),
        escapeCsvCell(r.endUserEmail ?? ''),
        escapeCsvCell(r.endUserName ?? ''),
        amountMajor,
        escapeCsvCell(r.currency),
        escapeCsvCell(r.status),
        escapeCsvCell(desc),
      ].join(',')
    );
  }
  return lines;
}

export async function runPaymentsExportQuery(
  filters: PaymentsDashboardFilters
): Promise<PaymentListRow[]> {
  return runPaymentsListQuery(filters, { limit: 100000, offset: 0 });
}

