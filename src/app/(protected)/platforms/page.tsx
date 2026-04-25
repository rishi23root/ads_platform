import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns, platforms } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { PlatformsTableWithDrawer } from '@/components/platforms-table-with-drawer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sites & apps',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function PlatformsPage({ searchParams }: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  const isAdmin = sessionWithRole.role === 'admin';

  // Run both queries in parallel: platform list and per-platform campaign link counts.
  // The unnest query counts platform links in SQL instead of loading all campaign rows.
  const [allPlatforms, platformLinkRows] = await Promise.all([
    db.select().from(platforms).orderBy(platforms.createdAt),
    db.execute<{ platform_id: string; linked_count: number }>(sql`
      SELECT pid::text AS platform_id, count(*)::int AS linked_count
      FROM ${campaigns}, unnest(${campaigns.platformIds}) AS pid
      WHERE ${campaigns.status}::text <> 'deleted'
      GROUP BY pid
    `),
  ]);

  const linkedCountByPlatformId = new Map<string, number>();
  for (const row of platformLinkRows) {
    linkedCountByPlatformId.set(row.platform_id, Number(row.linked_count));
  }

  const platformsWithCounts = allPlatforms.map((p) => ({
    ...p,
    linkedCampaignCount: linkedCountByPlatformId.get(p.id) ?? 0,
  }));

  const { edit } = await searchParams;

  return (
    <PlatformsTableWithDrawer
      platforms={platformsWithCounts}
      initialEditId={edit ?? null}
      isAdmin={isAdmin}
    />
  );
}
