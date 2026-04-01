import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { redirects } from '@/db/schema';
import { RedirectsTableWithDrawer } from '@/components/redirects-table-with-drawer';
import { getLinkedCampaignCountByRedirectId } from '@/lib/campaign-linked-counts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Redirects',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function RedirectsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  const isAdmin = sessionWithRole.role === 'admin';

  const [allRedirects, linkedByRedirectId] = await Promise.all([
    db.select().from(redirects).orderBy(redirects.createdAt),
    getLinkedCampaignCountByRedirectId(),
  ]);

  const redirectsWithCounts = allRedirects.map((r) => ({
    ...r,
    linkedCampaignCount: linkedByRedirectId.get(r.id) ?? 0,
  }));

  const { edit } = await searchParams;

  return (
    <RedirectsTableWithDrawer
      redirects={redirectsWithCounts}
      initialEditId={edit ?? null}
      isAdmin={isAdmin}
    />
  );
}
