import { redirect } from 'next/navigation';
import { getSessionWithRole } from '@/lib/dal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit platform',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPlatformPage({ params }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/platforms');

  const { id } = await params;
  redirect(`/platforms?edit=${id}`);
}
