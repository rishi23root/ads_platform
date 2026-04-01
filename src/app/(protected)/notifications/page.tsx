import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';
import { NotificationsTableWithDrawer } from '@/components/notifications-table-with-drawer';
import { getLinkedCampaignCountByNotificationId } from '@/lib/campaign-linked-counts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  const isAdmin = sessionWithRole.role === 'admin';

  const [allNotifications, linkedByNotificationId] = await Promise.all([
    db.select().from(notifications).orderBy(notifications.createdAt),
    getLinkedCampaignCountByNotificationId(),
  ]);

  const notificationsWithCounts = allNotifications.map((n) => ({
    ...n,
    linkedCampaignCount: linkedByNotificationId.get(n.id) ?? 0,
  }));

  const { edit } = await searchParams;

  return (
    <NotificationsTableWithDrawer
      notifications={notificationsWithCounts}
      initialEditId={edit ?? null}
      isAdmin={isAdmin}
    />
  );
}
