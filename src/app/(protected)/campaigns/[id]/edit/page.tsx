import { getSessionWithRole } from '@/lib/dal';
import { redirect, notFound } from 'next/navigation';
import { database as db } from '@/db';
import {
  campaigns,
  campaignPlatforms,
  campaignCountries,
  campaignAd,
  campaignNotification,
  platforms,
  ads,
  notifications,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CampaignForm } from '../../campaign-form';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/campaigns');

  const { id } = await params;
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) notFound();

  const [platformRows, countryRows, adRow, notifRow] = await Promise.all([
    db.select({ platformId: campaignPlatforms.platformId }).from(campaignPlatforms).where(eq(campaignPlatforms.campaignId, id)),
    db.select({ countryCode: campaignCountries.countryCode }).from(campaignCountries).where(eq(campaignCountries.campaignId, id)),
    db.select({ adId: campaignAd.adId }).from(campaignAd).where(eq(campaignAd.campaignId, id)).limit(1),
    db.select({ notificationId: campaignNotification.notificationId }).from(campaignNotification).where(eq(campaignNotification.campaignId, id)).limit(1),
  ]);

  const [platformsList, adsList, notificationsList] = await Promise.all([
    db.select({ id: platforms.id, name: platforms.name, domain: platforms.domain }).from(platforms).orderBy(platforms.name),
    db.select({ id: ads.id, name: ads.name }).from(ads).orderBy(ads.name),
    db.select({ id: notifications.id, title: notifications.title }).from(notifications).orderBy(notifications.title),
  ]);

  const campaign = {
    id: c.id,
    name: c.name,
    targetAudience: c.targetAudience,
    campaignType: c.campaignType,
    frequencyType: c.frequencyType,
    frequencyCount: c.frequencyCount,
    timeStart: c.timeStart,
    timeEnd: c.timeEnd,
    status: c.status,
    startDate: c.startDate ? c.startDate.toISOString() : null,
    endDate: c.endDate ? c.endDate.toISOString() : null,
    platformIds: platformRows.map((r) => r.platformId),
    countryCodes: countryRows.map((r) => r.countryCode),
    adId: adRow[0]?.adId ?? null,
    notificationId: notifRow[0]?.notificationId ?? null,
  };

  return (
    <div className="flex flex-col gap-4 p-4 pt-2 md:p-6 md:pt-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Edit Campaign</h1>
      <CampaignForm
        campaign={campaign}
        platforms={platformsList}
        adsList={adsList}
        notificationsList={notificationsList}
        mode="edit"
      />
    </div>
  );
}
