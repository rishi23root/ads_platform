import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { ads } from '@/db/schema';
import { AdsTableWithDrawer } from '@/components/ads-table-with-drawer';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function AdsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const allAds = await db.select().from(ads).orderBy(ads.createdAt);
  const { edit } = await searchParams;

  return <AdsTableWithDrawer ads={allAds} initialEditId={edit ?? null} />;
}
