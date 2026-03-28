import { ChartAreaInteractiveDynamic } from '@/components/chart-area-interactive-dynamic';
import { LiveConnectionsCard } from '@/components/live-connections-card';
import { SectionCards } from '@/components/section-cards';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns, enduserEvents, endUsers } from '@/db/schema';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import { RecentCampaignsTable } from '@/components/recent-campaigns-table';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSessionWithRole();
  if (!session) redirect('/login');

  const campaignScope =
    session.role === 'admin' ? undefined : eq(campaigns.createdBy, session.user.id);
  const campaignActiveWhere = campaignScope
    ? and(eq(campaigns.status, 'active'), campaignScope)
    : eq(campaigns.status, 'active');

  const totalCampaignsPromise = campaignScope
    ? db.select({ count: sql<number>`count(*)` }).from(campaigns).where(campaignScope)
    : db.select({ count: sql<number>`count(*)` }).from(campaigns);

  const logsCountPromise = campaignScope
    ? db
      .select({ count: sql<number>`count(*)` })
      .from(enduserEvents)
      .where(
        and(
          isNotNull(enduserEvents.campaignId),
          sql`exists (
              select 1 from ${campaigns} c
              where c.id = ${enduserEvents.campaignId}
              and c.created_by = ${session.user.id}
            )`
        )
      )
    : db
      .select({ count: sql<number>`count(*)` })
      .from(enduserEvents)
      .where(isNotNull(enduserEvents.campaignId));

  const recentCampaignsPromise = campaignScope
    ? db
      .select()
      .from(campaigns)
      .where(campaignScope)
      .orderBy(desc(campaigns.createdAt))
      .limit(10)
    : db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(10);

  const extensionUsersPromise =
    session.role === 'admin'
      ? db.select({ count: sql<number>`count(*)` }).from(endUsers)
      : db
          .select({
            count: sql<number>`count(distinct ${enduserEvents.endUserId})::int`,
          })
          .from(enduserEvents)
          .where(
            and(
              isNotNull(enduserEvents.campaignId),
              sql`exists (
              select 1 from ${campaigns} c
              where c.id = ${enduserEvents.campaignId}
              and c.created_by = ${session.user.id}
            )`
            )
          );

  const [activeCampaignsCount, totalCampaignsCount, logsCount, extensionUsersCount, recentCampaigns] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(campaigns)
        .where(campaignActiveWhere),
      totalCampaignsPromise,
      logsCountPromise,
      extensionUsersPromise,
      recentCampaignsPromise,
    ]);

  const activeCampaigns = Number(activeCampaignsCount[0]?.count || 0);
  const totalCampaigns = Number(totalCampaignsCount[0]?.count || 0);
  const campaignLogsCount = Number(logsCount[0]?.count || 0);
  const activeUsers = Number(extensionUsersCount[0]?.count || 0);
  const isAdmin = session.role === 'admin';

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Extension activity, request volume, and recent campaigns.
        </p>
      </div>

      <SectionCards
        activeCampaigns={activeCampaigns}
        totalCampaigns={totalCampaigns}
        campaignLogs={campaignLogsCount}
        activeUsers={activeUsers}
        extensionUsersCaption={
          isAdmin ? undefined : 'Distinct extension users with activity on your campaigns'
        }
        extraCard={isAdmin ? <LiveConnectionsCard /> : undefined}
      />

      <ChartAreaInteractiveDynamic />

      <section className="relative z-10 isolate">
        <div className="rounded-md border bg-card">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                <Button size="sm" asChild>
                  <Link href="/campaigns/new">
                    <IconPlus className="h-4 w-4" />
                    New campaign
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <RecentCampaignsTable campaigns={recentCampaigns} isAdmin={isAdmin} />
        </div>
      </section>
    </div>
  );
}
