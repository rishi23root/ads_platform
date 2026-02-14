import Link from 'next/link';
import { getSessionWithRole } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { database as db } from '@/db';
import {
  campaigns as campaignsTable,
  campaignPlatforms,
  campaignCountries,
  campaignAd,
  campaignNotification,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';

export const dynamic = 'force-dynamic';

async function getCampaignsWithDetails() {
  const list = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
  return Promise.all(
    list.map(async (c) => {
      const [platformRows, countryRows, adRow, notifRow] = await Promise.all([
        db.select({ platformId: campaignPlatforms.platformId }).from(campaignPlatforms).where(eq(campaignPlatforms.campaignId, c.id)),
        db.select({ countryCode: campaignCountries.countryCode }).from(campaignCountries).where(eq(campaignCountries.campaignId, c.id)),
        db.select({ adId: campaignAd.adId }).from(campaignAd).where(eq(campaignAd.campaignId, c.id)).limit(1),
        db.select({ notificationId: campaignNotification.notificationId }).from(campaignNotification).where(eq(campaignNotification.campaignId, c.id)).limit(1),
      ]);
      return {
        ...c,
        platformIds: platformRows.map((r) => r.platformId),
        countryCodes: countryRows.map((r) => r.countryCode),
        adId: adRow[0]?.adId ?? null,
        notificationId: notifRow[0]?.notificationId ?? null,
      };
    })
  );
}

export default async function CampaignsPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');

  const campaigns = await getCampaignsWithDetails();
  const isAdmin = sessionWithRole.role === 'admin';

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Targets</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                  No campaigns yet. {isAdmin && 'Create your first campaign.'}
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c: { id: string; name: string; campaignType: string; targetAudience: string; frequencyType: string; platformIds: string[]; countryCodes?: string[]; adId: string | null; notificationId: string | null }) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/campaigns/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.campaignType}</Badge>
                  </TableCell>
                  <TableCell>{c.targetAudience === 'new_users' ? 'New users' : 'All users'}</TableCell>
                  <TableCell>{c.frequencyType.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {c.platformIds?.length ?? 0} platforms
                      {(c.countryCodes?.length ?? 0) > 0 ? ` · ${c.countryCodes!.length} countries` : ' · All countries'}
                      {(c.campaignType === 'ads' || c.campaignType === 'popup') && (c.adId ? ' · 1 ad' : '')}
                      {c.campaignType === 'notification' && (c.notificationId ? ' · 1 notification' : '')}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/campaigns/${c.id}/edit`}>
                            <IconPencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteButton
                          id={c.id}
                          name={c.name}
                          entityType="campaign"
                          apiPath={`/api/campaigns/${c.id}`}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
