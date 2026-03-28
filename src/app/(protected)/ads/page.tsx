import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { ads } from '@/db/schema';
import { AdsTableWithDrawer } from '@/components/ads-table-with-drawer';
import { getLinkedCampaignCountByAdId } from '@/lib/campaign-linked-counts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ads',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function AdsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const [allAds, linkedByAdId] = await Promise.all([
    db.select().from(ads).orderBy(ads.createdAt),
    getLinkedCampaignCountByAdId(),
  ]);

  const adsWithCounts = allAds.map((a) => ({
    ...a,
    linkedCampaignCount: linkedByAdId.get(a.id) ?? 0,
  }));

  const { edit } = await searchParams;

  return <AdsTableWithDrawer ads={adsWithCounts} initialEditId={edit ?? null} />;
}
