'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TablePagination } from '@/components/ui/table-pagination';
import { VisitorIdCell } from '@/components/visitor-id-cell';

interface LogEntry {
  id: string;
  visitorId: string;
  domain: string;
  type: string;
  createdAt: string;
}

interface CampaignLogsTableProps {
  campaignId: string;
}

export function CampaignLogsTable({ campaignId }: CampaignLogsTableProps) {
  const [page, setPage] = React.useState(1);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${campaignId}/logs?page=${page}&pageSize=25`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch logs');
        return res.json();
      })
      .then((data: { logs: LogEntry[]; totalCount: number; totalPages: number }) => {
        if (!cancelled) {
          setLogs(data.logs);
          setTotalCount(data.totalCount);
          setTotalPages(data.totalPages);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load logs');
          setLogs([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, page]);

  if (error) {
    return (
      <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  const pageSize = 25;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-base font-semibold">
            Campaign Logs ({loading ? '…' : totalCount.toLocaleString()})
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Extension requests for this campaign. Paginated for performance.
          </p>
        </div>
        {!loading && (
          <div className="shrink-0">
            <TablePagination
              mode="button"
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                  Loading…
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                  No logs yet. Extension requests will appear here.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <VisitorIdCell visitorId={log.visitorId} />
                  </TableCell>
                  <TableCell className="text-sm">{log.domain}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
