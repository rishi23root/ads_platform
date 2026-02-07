import { notFound } from 'next/navigation';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';
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

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Notification</h1>
        <p className="text-muted-foreground">Update notification details</p>
      </div>
      <div className="max-w-2xl">
        <NotificationForm
          notification={notification}
          mode="edit"
        />
      </div>
    </div>
  );
}
