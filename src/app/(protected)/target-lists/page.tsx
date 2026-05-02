import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';
import { database as db } from '@/db';
import { targetLists } from '@/db/schema';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import { TargetListsTable } from '@/components/target-lists-table';
import { fetchCampaignCountByTargetList } from '@/lib/target-list-queries';
import { summarizeFilter, type TargetListFilterJson } from '@/lib/target-list-filter';
import { countTargetListMembers } from '@/lib/target-list-members-query';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audience lists',
};

export const dynamic = 'force-dynamic';

export default async function TargetListsPage() {
  const s = await getSessionWithRole();
  if (!s) redirect('/login');

  const [rows, counts] = await Promise.all([
    db.select().from(targetLists).orderBy(desc(targetLists.updatedAt)),
    fetchCampaignCountByTargetList(),
  ]);

  const isAdmin = s.role === 'admin';
  const data = await Promise.all(
    rows.map(async (r) => {
      const listIn = {
        id: r.id,
        memberIds: [...(r.memberIds ?? [])],
        excludedIds: [...(r.excludedIds ?? [])],
        filterJson: r.filterJson,
      };
      const qualifyingCount = await countTargetListMembers(listIn, 'all');
      return {
        id: r.id,
        name: r.name,
        filterSummary: summarizeFilter(r.filterJson as TargetListFilterJson),
        qualifyingCount,
        explicitMemberCount: (r.memberIds ?? []).length,
        campaignsUsing: counts[r.id] ?? 0,
        updatedAt: r.updatedAt.toISOString(),
      };
    })
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Audience lists"
        description="Groups of users your campaigns can target."
        actions={
          isAdmin ? (
            <Button asChild>
              <Link href="/target-lists/new">
                <IconPlus className="mr-2 h-4 w-4" />
                New audience list
              </Link>
            </Button>
          ) : undefined
        }
      />
      <TargetListsTable rows={data} isAdmin={isAdmin} />
    </div>
  );
}
