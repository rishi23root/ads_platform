import { redirect } from 'next/navigation';
import { getSessionWithRole } from '@/lib/dal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit ad',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAdPage({ params }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/ads');

  const { id } = await params;
  redirect(`/ads?edit=${id}`);
}
