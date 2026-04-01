import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns, platforms } from '@/db/schema';
import { ne } from 'drizzle-orm';
import { PlatformsTableWithDrawer } from '@/components/platforms-table-with-drawer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platforms',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function PlatformsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/');

  const allPlatforms = await db.select().from(platforms).orderBy(platforms.createdAt);
  const campaignPlatformRows = await db
    .select({ platformIds: campaigns.platformIds })
    .from(campaigns)
    .where(ne(campaigns.status, 'deleted'));

  const linkedCountByPlatformId = new Map<string, number>();
  for (const row of campaignPlatformRows) {
    for (const pid of row.platformIds ?? []) {
      linkedCountByPlatformId.set(pid, (linkedCountByPlatformId.get(pid) ?? 0) + 1);
    }
  }

  const platformsWithCounts = allPlatforms.map((p) => ({
    ...p,
    linkedCampaignCount: linkedCountByPlatformId.get(p.id) ?? 0,
  }));

  const { edit } = await searchParams;

  return <PlatformsTableWithDrawer platforms={platformsWithCounts} initialEditId={edit ?? null} />;
}
