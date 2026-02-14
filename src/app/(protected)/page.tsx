import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { LiveConnectionsCard } from '@/components/live-connections-card';
import { SectionCards } from '@/components/section-cards';
import { database as db } from '@/db';
import { campaigns, campaignLogs, visitors } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import Link from 'next/link';
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
import { IconPencil } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [activeCampaignsCount, totalCampaignsCount, logsCount, visitorsCount, recentCampaigns] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(campaigns)
        .where(eq(campaigns.status, 'active')),
      db.select({ count: sql<number>`count(*)` }).from(campaigns),
      db.select({ count: sql<number>`count(*)` }).from(campaignLogs),
      db.select({ count: sql<number>`count(*)` }).from(visitors),
      db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(10),
    ]);

  const activeCampaigns = Number(activeCampaignsCount[0]?.count || 0);
  const totalCampaigns = Number(totalCampaignsCount[0]?.count || 0);
  const campaignLogsCount = Number(logsCount[0]?.count || 0);
  const activeUsers = Number(visitorsCount[0]?.count || 0);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards
        activeCampaigns={activeCampaigns}
        totalCampaigns={totalCampaigns}
        campaignLogs={campaignLogsCount}
        activeUsers={activeUsers}
        extraCard={<LiveConnectionsCard />}
      />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Recent Campaigns</h2>
          <p className="text-sm text-muted-foreground">Latest campaigns</p>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No campaigns yet. Create your first campaign.
                  </TableCell>
                </TableRow>
              ) : (
                recentCampaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="hover:underline text-foreground"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.campaignType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === 'active'
                            ? 'default'
                            : c.status === 'expired'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/campaigns/${c.id}/edit`}>
                          <IconPencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
