import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { platforms, ads, notifications } from '@/db/schema';
import { CampaignForm } from '../campaign-form';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/campaigns');

  const [platformsList, adsList, notificationsList] = await Promise.all([
    db.select({ id: platforms.id, name: platforms.name, domain: platforms.domain }).from(platforms).orderBy(platforms.name),
    db.select({ id: ads.id, name: ads.name }).from(ads).orderBy(ads.name),
    db.select({ id: notifications.id, title: notifications.title }).from(notifications).orderBy(notifications.title),
  ]);

  return (
    <div className="flex flex-col gap-4 p-4 pt-2 md:p-6 md:pt-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">New Campaign</h1>
      <CampaignForm
        platforms={platformsList}
        adsList={adsList}
        notificationsList={notificationsList}
        mode="create"
      />
    </div>
  );
}
