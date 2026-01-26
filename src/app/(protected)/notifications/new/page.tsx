import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { NotificationForm } from '../notification-form';

export default async function NewNotificationPage() {
  // Fetch all platforms for the dropdown
  const allPlatforms = await db
    .select()
    .from(platforms)
    .orderBy(platforms.name);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Notification</h1>
        <p className="text-muted-foreground">Create a new notification for specific domains</p>
      </div>
      <div className="max-w-2xl">
        <NotificationForm platforms={allPlatforms} mode="create" />
      </div>
    </div>
  );
}
