import { notFound } from 'next/navigation';
import { database as db } from '@/db';
import { notifications, notificationPlatforms, platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NotificationForm } from '../../notification-form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditNotificationPage({ params }: PageProps) {
  const { id } = await params;

  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);

  if (!notification) {
    notFound();
  }

  // Fetch all platforms for the dropdown
  const allPlatforms = await db
    .select()
    .from(platforms)
    .orderBy(platforms.name);

  // Fetch selected platform IDs for this notification
  const selectedPlatforms = await db
    .select({ platformId: notificationPlatforms.platformId })
    .from(notificationPlatforms)
    .where(eq(notificationPlatforms.notificationId, id));

  const selectedPlatformIds = selectedPlatforms.map((p) => p.platformId);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Notification</h1>
        <p className="text-muted-foreground">Update notification details</p>
      </div>
      <div className="max-w-2xl">
        <NotificationForm
          notification={notification}
          platforms={allPlatforms}
          selectedPlatformIds={selectedPlatformIds}
          mode="edit"
        />
      </div>
    </div>
  );
}
