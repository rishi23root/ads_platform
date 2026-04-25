import { ChartAreaInteractiveDynamic } from '@/components/chart-area-interactive-dynamic';
import { LiveConnectionsCard } from '@/components/live-connections-card';
import { SectionCards } from '@/components/section-cards';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns, enduserEvents, endUsers } from '@/db/schema';
import { DASHBOARD_SERVED_EVENT_TYPES } from '@/lib/events-dashboard';
import { and, desc, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { campaignRowNotSoftDeleted } from '@/lib/campaign-soft-delete-sql';
import { getPaymentsSummary } from '@/lib/payments-dashboard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import { RecentCampaignsTable } from '@/components/recent-campaigns-table';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export const dynamic = 'force-dynamic';

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function percentChangeVsPriorMonth(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

export default async function DashboardPage() {
  const session = await getSessionWithRole();
  if (!session) redirect('/login');

  const isAdmin = session.role === 'admin';

  // Single conditional-aggregation query replaces two separate campaign count queries.
  const campaignCountsPromise = db
    .select({
      total: sql<number>`count(*) filter (where ${ne(campaigns.status, 'deleted')})::int`,
      active: sql<number>`count(*) filter (where ${campaigns.status} = 'active')::int`,
    })
    .from(campaigns);

  const impressionsCountPromise = db
    .select({ count: sql<number>`count(*)` })
    .from(enduserEvents)
    .where(
      and(
        isNotNull(enduserEvents.campaignId),
        inArray(enduserEvents.type, DASHBOARD_SERVED_EVENT_TYPES)
      )
    );

  const recentCampaignsPromise = db
    .select()
    .from(campaigns)
    .where(campaignRowNotSoftDeleted)
    .orderBy(desc(campaigns.createdAt))
    .limit(10);

  const extensionUsersPromise = db.select({ count: sql<number>`count(*)` }).from(endUsers);

  const [campaignCounts, impressionsCount, extensionUsersCount, recentCampaignsRaw, paymentSummary] =
    await Promise.all([
      campaignCountsPromise,
      impressionsCountPromise,
      extensionUsersPromise,
      recentCampaignsPromise,
      isAdmin ? getPaymentsSummary() : Promise.resolve(null),
    ]);

  const recentCampaignIds = recentCampaignsRaw.map((c) => c.id);
  const impressionByCampaign = new Map<string, number>();
  if (recentCampaignIds.length > 0) {
    const perCampaignRows = await db
      .select({
        campaignId: enduserEvents.campaignId,
        count: sql<number>`count(*)::int`,
      })
      .from(enduserEvents)
      .where(
        and(
          inArray(enduserEvents.campaignId, recentCampaignIds),
          inArray(enduserEvents.type, DASHBOARD_SERVED_EVENT_TYPES)
        )
      )
      .groupBy(enduserEvents.campaignId);
    for (const row of perCampaignRows) {
      if (row.campaignId) impressionByCampaign.set(row.campaignId, Number(row.count));
    }
  }

  const recentCampaigns = recentCampaignsRaw.map((c) => ({
    ...c,
    impressions: impressionByCampaign.get(c.id) ?? 0,
  }));

  const activeCampaigns = Number(campaignCounts[0]?.active || 0);
  const totalCampaigns = Number(campaignCounts[0]?.total || 0);
  const campaignImpressions = Number(impressionsCount[0]?.count || 0);
  const activeUsers = Number(extensionUsersCount[0]?.count || 0);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Extension activity, campaign impressions, and recent campaigns.
        </p>
      </div>

      <SectionCards
        activeCampaigns={activeCampaigns}
        totalCampaigns={totalCampaigns}
        campaignImpressions={campaignImpressions}
        activeUsers={activeUsers}
        extraCard={<LiveConnectionsCard />}
        paymentsThisMonth={
          isAdmin && paymentSummary
            ? {
                amountLabel: formatUsdFromCents(paymentSummary.totalThisMonthCents),
                completedCount: paymentSummary.completedPaymentsThisMonthCount,
                changePercent: percentChangeVsPriorMonth(
                  paymentSummary.totalThisMonthCents,
                  paymentSummary.totalPriorMonthCents
                ),
              }
            : undefined
        }
      />

      <ChartAreaInteractiveDynamic />

      <section className="relative z-10 isolate">
        <DataTableSurface variant="embedded" className="flex flex-col">
          <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold">Recent campaigns</h2>
              <p className="text-sm text-muted-foreground">
                Latest updates in your workspace
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link href="/campaigns">View all</Link>
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/campaigns/new">
                    <IconPlus className="h-4 w-4" />
                    New campaign
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <RecentCampaignsTable campaigns={recentCampaigns} isAdmin={isAdmin} />
        </DataTableSurface>
      </section>
    </div>
  );
}
