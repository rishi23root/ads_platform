import { redirect } from 'next/navigation';
import { getSessionWithRole } from '@/lib/dal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit redirect',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRedirectPage({ params }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/redirects');

  const { id } = await params;
  redirect(`/redirects?edit=${id}`);
}
