import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { PlatformsTableWithDrawer } from '@/components/platforms-table-with-drawer';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function PlatformsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const allPlatforms = await db.select().from(platforms).orderBy(platforms.createdAt);
  const { edit } = await searchParams;

  return <PlatformsTableWithDrawer platforms={allPlatforms} initialEditId={edit ?? null} />;
}
