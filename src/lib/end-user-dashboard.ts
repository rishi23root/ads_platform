import 'server-only';

import { database as db } from '@/db';
import { campaigns, endUsers, enduserEvents, enduserSessions, payments } from '@/db/schema';
import type { EndUserDashboardSnapshot } from '@/lib/end-user-dashboard-types';
import { eventsAccessScopeForRole } from '@/lib/events-dashboard';
import { and, desc, eq, isNotNull, ne, sql, type SQL } from 'drizzle-orm';

export type { EndUserDashboardSnapshot } from '@/lib/end-user-dashboard-types';

export type EndUserDashboardViewer = { id: string; role: 'user' | 'admin' };

function endUserEventsWhereForViewer(
  userIdent: string | null,
  viewer?: EndUserDashboardViewer
): SQL {
  const userPart = userIdent ? eq(enduserEvents.userIdentifier, userIdent) : sql`1 = 0`;
  if (!viewer || viewer.role === 'admin') {
    return userPart;
  }
  const scope = eventsAccessScopeForRole('user', viewer.id);
  return scope ? and(userPart, scope)! : userPart;
}

/**
 * Lifetime aggregates for the admin extension user dashboard (events keyed by `end_users.identifier`).
 * Non-admins only see payment/session totals and event rows scoped to campaigns they created.
 */
export async function getEndUserDashboardSnapshot(
  endUserUuidString: string,
  viewer?: EndUserDashboardViewer
): Promise<EndUserDashboardSnapshot> {
  const isAdmin = !viewer || viewer.role === 'admin';

  const [userRow] = await db
    .select({ identifier: endUsers.identifier })
    .from(endUsers)
    .where(eq(endUsers.id, endUserUuidString))
    .limit(1);
  const userIdent = userRow?.identifier ?? null;

  const eventWhere = endUserEventsWhereForViewer(userIdent, viewer);
  const eventWhereWithCountry = and(
    eventWhere,
    isNotNull(enduserEvents.country),
    ne(enduserEvents.country, '')
  )!;

  const [
    paymentRow,
    sessionRow,
    eventRow,
    campaignRows,
    countryRows,
  ] = await Promise.all([
    isAdmin
      ? db
          .select({
            completedCount: sql<number>`count(*)::int`,
            completedSumAmount: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
            lastPaymentAt: sql<Date | null>`max(${payments.paymentDate})`,
            currency: sql<string>`(array_agg(${payments.currency} order by ${payments.paymentDate} desc))[1]`,
          })
          .from(payments)
          .where(and(eq(payments.endUserId, endUserUuidString), eq(payments.status, 'completed')))
          .then((rows) => rows[0])
      : Promise.resolve(null),

    isAdmin
      ? db
          .select({
            total: sql<number>`count(*)::int`,
            active: sql<number>`coalesce(sum(case when ${enduserSessions.expiresAt} > now() then 1 else 0 end), 0)::int`,
          })
          .from(enduserSessions)
          .where(eq(enduserSessions.endUserId, endUserUuidString))
          .then((rows) => rows[0])
      : Promise.resolve(null),

    db
      .select({
        total: sql<number>`count(*)::int`,
        firstAt: sql<Date | null>`min(${enduserEvents.createdAt})`,
        lastAt: sql<Date | null>`max(${enduserEvents.createdAt})`,
        distinctDomains: sql<number>`count(distinct ${enduserEvents.domain})::int`,
        distinctCampaignsWithEvents: sql<number>`count(distinct ${enduserEvents.campaignId})::int`,
      })
      .from(enduserEvents)
      .where(eventWhere)
      .then((rows) => rows[0]),

    db
      .select({
        campaignId: enduserEvents.campaignId,
        campaignName: campaigns.name,
        eventCount: sql<number>`count(*)::int`,
      })
      .from(enduserEvents)
      .innerJoin(campaigns, eq(campaigns.id, enduserEvents.campaignId))
      .where(eventWhere)
      .groupBy(enduserEvents.campaignId, campaigns.name)
      .orderBy(desc(sql`count(*)`))
      .limit(20),

    db
      .select({
        country: enduserEvents.country,
        eventCount: sql<number>`count(*)::int`,
      })
      .from(enduserEvents)
      .where(eventWhereWithCountry)
      .groupBy(enduserEvents.country)
      .orderBy(desc(sql`count(*)`)),
  ]);

  const campaignsList = (campaignRows ?? [])
    .filter((r): r is typeof r & { campaignId: string } => r.campaignId != null)
    .map((r) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      eventCount: Number(r.eventCount),
    }));

  const eventCountries = (countryRows ?? [])
    .filter((r): r is typeof r & { country: string } => Boolean(r.country?.trim()))
    .map((r) => ({
      code: r.country.trim().toUpperCase(),
      eventCount: Number(r.eventCount),
    }));

  return {
    payments: {
      completedCount: Number(paymentRow?.completedCount ?? 0),
      completedSumAmount: Number(paymentRow?.completedSumAmount ?? 0),
      currency: paymentRow?.currency ?? 'USD',
      lastPaymentAt: paymentRow?.lastPaymentAt
        ? (paymentRow.lastPaymentAt instanceof Date
            ? paymentRow.lastPaymentAt
            : new Date(paymentRow.lastPaymentAt)
          ).toISOString()
        : null,
    },
    sessions: {
      total: Number(sessionRow?.total ?? 0),
      active: Number(sessionRow?.active ?? 0),
    },
    events: {
      total: Number(eventRow?.total ?? 0),
      firstAt: eventRow?.firstAt
        ? (eventRow.firstAt instanceof Date ? eventRow.firstAt : new Date(eventRow.firstAt)).toISOString()
        : null,
      lastAt: eventRow?.lastAt
        ? (eventRow.lastAt instanceof Date ? eventRow.lastAt : new Date(eventRow.lastAt)).toISOString()
        : null,
      distinctDomains: Number(eventRow?.distinctDomains ?? 0),
      distinctCampaignsWithEvents: Number(eventRow?.distinctCampaignsWithEvents ?? 0),
    },
    campaigns: campaignsList,
    eventCountries,
  };
}
