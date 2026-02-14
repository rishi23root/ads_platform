import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';
import { NotificationsTableWithDrawer } from '@/components/notifications-table-with-drawer';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const allNotifications = await db
    .select()
    .from(notifications)
    .orderBy(notifications.createdAt);

  const { edit } = await searchParams;

  return (
    <NotificationsTableWithDrawer
      notifications={allNotifications}
      initialEditId={edit ?? null}
    />
  );
}
