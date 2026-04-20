import Link from 'next/link';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns as campaignsTable, targetLists } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { campaignRowNotSoftDeleted } from '@/lib/campaign-soft-delete-sql';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import { CampaignsListTable } from '@/components/campaigns-list-table';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campaigns',
};

export const dynamic = 'force-dynamic';

async function getCampaignsWithDetails(createdByUserId?: string, includeSoftDeleted = false) {
  const filtered =
    createdByUserId !== undefined
      ? includeSoftDeleted
        ? db.select().from(campaignsTable).where(eq(campaignsTable.createdBy, createdByUserId))
        : db
            .select()
            .from(campaignsTable)
            .where(and(eq(campaignsTable.createdBy, createdByUserId), campaignRowNotSoftDeleted))
      : includeSoftDeleted
        ? db.select().from(campaignsTable)
        : db.select().from(campaignsTable).where(campaignRowNotSoftDeleted);
  const list = await filtered.orderBy(desc(campaignsTable.createdAt));
  const targetListIds = [
    ...new Set(list.map((c) => c.targetListId).filter((id): id is string => Boolean(id))),
  ];
  const targetListRows =
    targetListIds.length > 0
      ? await db
          .select({ id: targetLists.id, name: targetLists.name })
          .from(targetLists)
          .where(inArray(targetLists.id, targetListIds))
      : [];
  const targetListNameById = new Map(targetListRows.map((r) => [r.id, r.name]));
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    campaignType: c.campaignType,
    targetAudience: c.targetAudience,
    targetListId: c.targetListId ?? null,
    targetListName: c.targetListId ? targetListNameById.get(c.targetListId) ?? null : null,
    frequencyType: c.frequencyType,
    status: c.status,
    startDate: c.startDate ? c.startDate.toISOString() : null,
    endDate: c.endDate ? c.endDate.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
    adId: c.adId ?? null,
    notificationId: c.notificationId ?? null,
    redirectId: c.redirectId ?? null,
  }));
}

export default async function CampaignsPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');

  const isAdmin = sessionWithRole.role === 'admin';
  // Admins load soft-deleted rows too so the list status filter (e.g. "Deleted") can show them.
  const campaigns = await getCampaignsWithDetails(undefined, isAdmin);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Create and manage campaigns' : 'View campaigns'}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/campaigns/new">
              <IconPlus className="mr-2 h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        )}
      </div>

      <CampaignsListTable campaigns={campaigns} isAdmin={isAdmin} />
    </div>
  );
}
