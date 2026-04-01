import { redirect } from 'next/navigation';
import { getSessionWithRole } from '@/lib/dal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit notification',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditNotificationPage({ params }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/notifications');

  const { id } = await params;
  redirect(`/notifications?edit=${id}`);
}
