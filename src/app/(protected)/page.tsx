import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DashboardAdsTable } from '@/components/dashboard-ads-table';
import { SectionCards } from '@/components/section-cards';
import { database as db } from '@/db';
import { ads, platforms, adPlatforms, notifications } from '@/db/schema';
import { eq, lt, and, inArray } from 'drizzle-orm';

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

  // Fetch all data (analytics stats are on the Analytics page only)
  const [allAdsForStats, recentAdsRows, allPlatforms, allNotifications] = await Promise.all([
    db.select({ status: ads.status }).from(ads), // For stats only
    db.select().from(ads).orderBy(ads.createdAt).limit(10),
    db.select().from(platforms),
    db.select().from(notifications),
  ]);

  const recentAdIds = recentAdsRows.map((a) => a.id);
  const recentLinks =
    recentAdIds.length > 0
      ? await db
          .select({
            adId: adPlatforms.adId,
            platformName: platforms.name,
            platformDomain: platforms.domain,
          })
          .from(adPlatforms)
          .innerJoin(platforms, eq(adPlatforms.platformId, platforms.id))
          .where(inArray(adPlatforms.adId, recentAdIds))
      : [];

  const platformsByAdId = recentLinks.reduce<
    Record<string, { name: string; domain: string }[]>
  >((acc, row) => {
    if (!acc[row.adId]) acc[row.adId] = [];
    acc[row.adId].push({ name: row.platformName, domain: row.platformDomain });
    return acc;
  }, {});

  // Calculate stats from all ads
  const totalAds = allAdsForStats.length;
  const activeAds = allAdsForStats.filter((ad) => ad.status === 'active').length;
  const expiredAds = allAdsForStats.filter((ad) => ad.status === 'expired').length;
  const scheduledAds = allAdsForStats.filter((ad) => ad.status === 'scheduled').length;
  const activePlatforms = allPlatforms.filter((p) => p.isActive).length;
  const unreadNotifications = allNotifications.filter((n) => !n.isRead).length;

  // Prepare data for dashboard table (showing recent ads)
  const tableData = recentAdsRows.map((ad) => {
    const adPlatformList = platformsByAdId[ad.id] ?? [];
    const platformStr =
      adPlatformList.length > 0
        ? adPlatformList.map((p) => p.domain || p.name).join(', ')
        : '-';
    return {
      id: ad.id,
      name: ad.name,
      platform: platformStr,
      platformDomain: adPlatformList[0]?.domain ?? null,
      platformName: adPlatformList[0]?.name ?? null,
      platforms: adPlatformList,
      status: ad.status,
      dateRange:
        ad.startDate && ad.endDate
          ? `${new Date(ad.startDate).toLocaleDateString()} - ${new Date(ad.endDate).toLocaleDateString()}`
          : ad.startDate
            ? `Starts: ${new Date(ad.startDate).toLocaleDateString()}`
            : ad.endDate
              ? `Ends: ${new Date(ad.endDate).toLocaleDateString()}`
              : '-',
      createdAt: new Date(ad.createdAt).toLocaleDateString(),
    };
  });

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
