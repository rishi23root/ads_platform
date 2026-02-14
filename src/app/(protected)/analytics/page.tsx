import { database as db } from '@/db';
import { visitors, campaignLogs } from '@/db/schema';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconUsers, IconChartBar, IconAd2, IconBell } from '@tabler/icons-react';
import { desc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const typeColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ad: 'default',
  notification: 'secondary',
  popup: 'outline',
};

export default async function AnalyticsPage() {
  // Fetch analytics data (visitors, campaign_logs)
  const [allVisitors, allLogs, adLogs, notificationLogs] = await Promise.all([
    db.select().from(visitors),
    db.select().from(campaignLogs).orderBy(desc(campaignLogs.createdAt)).limit(100),
    db.select({ count: sql<number>`count(*)` }).from(campaignLogs).where(eq(campaignLogs.type, 'ad')),
    db.select({ count: sql<number>`count(*)` }).from(campaignLogs).where(eq(campaignLogs.type, 'notification')),
  ]);

  const totalUsers = allVisitors.length;
  const totalRequests = allLogs.length;
  const adsServed = Number(adLogs[0]?.count || 0);
  const notificationsSent = Number(notificationLogs[0]?.count || 0);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Extension Insights</h1>
        <p className="text-muted-foreground">Extension user activity and request logs</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <CardDescription className="text-xs">
              Unique extension users
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <IconChartBar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <CardDescription className="text-xs">
              Recent requests (last 100)
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ads Served</CardTitle>
            <IconAd2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adsServed}</div>
            <CardDescription className="text-xs">
              Total ad requests
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications Sent</CardTitle>
            <IconBell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notificationsSent}</div>
            <CardDescription className="text-xs">
              Total notification requests
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Request Logs Table */}
      <div className="rounded-md border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Recent Request Logs</h2>
          <p className="text-sm text-muted-foreground">Latest 100 requests from extension users</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor ID</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No campaign logs found. Extension requests will appear here.
                </TableCell>
              </TableRow>
            ) : (
              allLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    {log.visitorId}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.campaignId.slice(0, 8)}…
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {log.domain}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeColors[log.type] || 'secondary'}>
                      {log.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
