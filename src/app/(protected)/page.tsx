import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DashboardAdsTable } from '@/components/dashboard-ads-table';
import { SectionCards } from '@/components/section-cards';
import { database as db } from '@/db';
import { ads, platforms, notifications, extensionUsers, requestLogs } from '@/db/schema';
import { eq, lt, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Helper function to auto-expire ads
async function autoExpireAds() {
  const now = new Date();
  await db
    .update(ads)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(ads.status, 'active'),
        lt(ads.endDate, now)
      )
    );
}

export default async function DashboardPage() {
  // Auto-expire ads that have passed their end date
  await autoExpireAds();

  // Fetch all data
  const [allAdsForStats, recentAds, allPlatforms, allNotifications, allExtensionUsers, adLogsCount, notificationLogsCount] = await Promise.all([
    db.select({ status: ads.status }).from(ads), // For stats only
    db
      .select({
        id: ads.id,
        name: ads.name,
        description: ads.description,
        status: ads.status,
        startDate: ads.startDate,
        endDate: ads.endDate,
        createdAt: ads.createdAt,
        platformName: platforms.name,
        platformDomain: platforms.domain,
      })
      .from(ads)
      .leftJoin(platforms, eq(ads.platformId, platforms.id))
      .orderBy(ads.createdAt)
      .limit(10),
    db.select().from(platforms),
    db.select().from(notifications),
    db.select().from(extensionUsers),
    db.select({ count: sql<number>`count(*)` }).from(requestLogs).where(eq(requestLogs.requestType, 'ad')),
    db.select({ count: sql<number>`count(*)` }).from(requestLogs).where(eq(requestLogs.requestType, 'notification')),
  ]);

  // Calculate stats from all ads
  const totalAds = allAdsForStats.length;
  const activeAds = allAdsForStats.filter((ad) => ad.status === 'active').length;
  const expiredAds = allAdsForStats.filter((ad) => ad.status === 'expired').length;
  const scheduledAds = allAdsForStats.filter((ad) => ad.status === 'scheduled').length;
  const activePlatforms = allPlatforms.filter((p) => p.isActive).length;
  const unreadNotifications = allNotifications.filter((n) => !n.isRead).length;
  
  // Analytics stats
  const totalExtensionUsers = allExtensionUsers.length;
  const totalRequests = allExtensionUsers.reduce((sum, user) => sum + user.totalRequests, 0);
  const adsServed = Number(adLogsCount[0]?.count || 0);
  const notificationsSent = Number(notificationLogsCount[0]?.count || 0);

  // Prepare data for dashboard table (showing recent ads)
  const tableData = recentAds.map((ad) => ({
    id: ad.id,
    name: ad.name,
    platform: ad.platformDomain || ad.platformName || '-',
    platformDomain: ad.platformDomain,
    platformName: ad.platformName,
    status: ad.status,
    dateRange: ad.startDate && ad.endDate
      ? `${new Date(ad.startDate).toLocaleDateString()} - ${new Date(ad.endDate).toLocaleDateString()}`
      : ad.startDate
      ? `Starts: ${new Date(ad.startDate).toLocaleDateString()}`
      : ad.endDate
      ? `Ends: ${new Date(ad.endDate).toLocaleDateString()}`
      : '-',
    createdAt: new Date(ad.createdAt).toLocaleDateString(),
  }));

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards
        totalAds={totalAds}
        activeAds={activeAds}
        expiredAds={expiredAds}
        scheduledAds={scheduledAds}
        totalPlatforms={allPlatforms.length}
        activePlatforms={activePlatforms}
        totalNotifications={allNotifications.length}
        unreadNotifications={unreadNotifications}
        totalExtensionUsers={totalExtensionUsers}
        totalRequests={totalRequests}
        adsServed={adsServed}
        notificationsSent={notificationsSent}
      />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Recent Ads</h2>
          <p className="text-sm text-muted-foreground">Latest advertisements and campaigns</p>
        </div>
        <DashboardAdsTable data={tableData} />
      </div>
    </div>
  );
}
