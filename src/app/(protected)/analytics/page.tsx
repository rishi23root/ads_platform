import { database as db } from '@/db';
import { visitors } from '@/db/schema';
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
import { RefreshDataButton } from '@/components/refresh-data-button';
import { CopyableIdCell } from '@/components/copyable-id-cell';
import { getCountryName } from '@/lib/countries';
import { IconUsers, IconChartBar, IconAd2, IconBell } from '@tabler/icons-react';
import { desc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const typeColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ad: 'default',
  notification: 'secondary',
  popup: 'outline',
  request: 'secondary',
};

export default async function AnalyticsPage() {
  // Fetch analytics data (counts + recent logs for table)
  const [visitorsCount, totalLogsCount, adLogsCount, notificationLogsCount, recentLogs] =
    await Promise.all([
      db.select({ count: sql<number>`count(DISTINCT visitor_id)` }).from(visitors),
      db.select({ count: sql<number>`count(*)` }).from(visitors),
      db
        .select({ count: sql<number>`count(*)` })
        .from(visitors)
        .where(eq(visitors.type, 'ad')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(visitors)
        .where(eq(visitors.type, 'notification')),
      db
        .select()
        .from(visitors)
        .orderBy(desc(visitors.createdAt))
        .limit(100),
    ]);

  const totalUsers = Number(visitorsCount[0]?.count ?? 0);
  const totalRequests = Number(totalLogsCount[0]?.count ?? 0);
  const adsServed = Number(adLogsCount[0]?.count ?? 0);
  const notificationsSent = Number(notificationLogsCount[0]?.count ?? 0);

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
              All extension requests
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
        <div className="p-4 border-b flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-semibold">Recent Request Logs</h2>
            <p className="text-sm text-muted-foreground">All extension requests (latest 100)</p>
          </div>
          <RefreshDataButton ariaLabel="Refresh logs" className="shrink-0" />
        </div>
        <div className="w-full overflow-x-auto">
          <Table className="w-full table-auto">
            <colgroup>
              <col style={{ width: 'auto' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '170px' }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Visitor ID</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No requests yet. Extension requests will appear here.
                  </TableCell>
                </TableRow>
              ) : (
                recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="py-2 overflow-hidden">
                      <CopyableIdCell
                        value={log.visitorId}
                        truncateLength={12}
                        copyLabel="Visitor ID copied to clipboard"
                      />
                    </TableCell>
                    <TableCell className="py-2 overflow-hidden">
                      {log.campaignId ? (
                        <CopyableIdCell
                          value={log.campaignId}
                          truncateLength={8}
                          copyLabel="Campaign ID copied to clipboard"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 overflow-hidden">
                      <span className="truncate block" title={log.domain ?? ''}>
                        {log.domain}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 overflow-hidden">
                      {log.country ? (
                        <span title={getCountryName(log.country)} className="uppercase text-sm">
                          {log.country}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 overflow-hidden">
                      <Badge variant={typeColors[log.type] || 'secondary'}>
                        {log.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-sm tabular-nums">
                      {log.statusCode ?? '—'}
                    </TableCell>
                    <TableCell className="py-2 text-sm text-muted-foreground min-w-0">
                      {new Date(log.createdAt).toLocaleString()}
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
