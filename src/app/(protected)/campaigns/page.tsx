import Link from 'next/link';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import { campaigns as campaignsTable } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import { CampaignsListTable } from '@/components/campaigns-list-table';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campaigns',
};

export const dynamic = 'force-dynamic';

async function getCampaignsWithDetails(createdByUserId?: string) {
  const base = db.select().from(campaignsTable);
  const filtered =
    createdByUserId !== undefined
      ? base.where(eq(campaignsTable.createdBy, createdByUserId))
      : base;
  const list = await filtered.orderBy(desc(campaignsTable.createdAt));
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    campaignType: c.campaignType,
    targetAudience: c.targetAudience,
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
  const campaigns = await getCampaignsWithDetails(
    isAdmin ? undefined : sessionWithRole.user.id
  );

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
