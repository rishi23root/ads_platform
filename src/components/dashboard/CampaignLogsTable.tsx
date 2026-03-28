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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EndUserIdCell } from '@/components/enduser-id-cell';
import { IconRefresh } from '@tabler/icons-react';
import { getCountryName } from '@/lib/countries';

interface LogEntry {
  id: string;
  endUserId: string;
  domain: string | null;
  type: string;
  statusCode: number | null;
  createdAt: string;
  country: string | null;
  email: string | null;
  plan: string;
  userAgent: string | null;
}

interface CampaignLogsTableProps {
  campaignId: string;
}

function isWithinInteractiveControl(target: EventTarget | null): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Text
        ? target.parentElement
        : null;
  if (!el) return false;
  return Boolean(
    el.closest(
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="combobox"]'
    )
  );
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'ad', label: 'Ad' },
  { value: 'notification', label: 'Notification' },
  { value: 'popup', label: 'Popup' },
  { value: 'request', label: 'Request' },
  { value: 'redirect', label: 'Redirect' },
  { value: 'visit', label: 'Visit' },
] as const;

export function CampaignLogsTable({ campaignId }: CampaignLogsTableProps) {
  const [page, setPage] = React.useState(1);
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<LogEntry | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [typeFilter, campaignId]);

  React.useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const typeQ = typeFilter !== 'all' ? `&type=${encodeURIComponent(typeFilter)}` : '';
    fetch(`/api/campaigns/${campaignId}/logs?page=${page}&pageSize=25${typeQ}`, {
      signal: ac.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch logs');
        return res.json();
      })
      .then((data: { logs: LogEntry[]; totalCount: number; totalPages: number }) => {
        setLogs(data.logs);
        setTotalCount(data.totalCount);
        setTotalPages(data.totalPages);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load logs');
        setLogs([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [campaignId, page, refreshNonce, typeFilter]);

  if (error) {
    return (
      <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  const pageSize = 25;
  const colCount = 6;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-base font-semibold">
            Campaign Logs ({loading ? '…' : totalCount.toLocaleString()})
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Extension requests for this campaign. Paginated for performance. Select a row for full
            detail.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div>
            <span id="log-type-filter-label" className="sr-only">
              Filter logs by event type
            </span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="w-full sm:w-[160px]"
                aria-labelledby="log-type-filter-label"
                disabled={loading}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (totalPages > 0 || totalCount > 0) && (
              <TablePagination
                mode="button"
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setRefreshNonce((n) => n + 1)}
              disabled={loading}
              aria-label="Refresh logs"
              className="h-9 w-9 min-h-9 min-w-9"
            >
              <IconRefresh className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>End user</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground text-sm">
                  Loading…
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground text-sm">
                  No logs yet. Extension requests will appear here.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  aria-label={`Log detail ${log.type} at ${new Date(log.createdAt).toLocaleString()}`}
                  onClick={(e) => {
                    if (isWithinInteractiveControl(e.target)) return;
                    setDetail(log);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail(log);
                    }
                  }}
                >
                  <TableCell>
                    <EndUserIdCell endUserId={log.endUserId} />
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px]">
                    {log.domain ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate">{log.domain}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm break-all">
                          {log.domain}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.country ? (
                      <span>
                        {getCountryName(log.country)} <span className="text-muted-foreground">({log.country})</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{log.statusCode ?? '—'}</TableCell>
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

      <Sheet open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="pr-8">
                <SheetTitle className="break-words">Log event</SheetTitle>
                <SheetDescription>
                  {new Date(detail.createdAt).toLocaleString(undefined, {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-4 px-4 pb-6 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    End user
                  </p>
                  <EndUserIdCell endUserId={detail.endUserId} />
                </div>
                {detail.email && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                      Email
                    </p>
                    <p className="break-all">{detail.email}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Plan
                  </p>
                  <Badge variant="secondary" className="capitalize">
                    {detail.plan}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Domain
                  </p>
                  <p className="break-all">{detail.domain ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Country
                  </p>
                  <p>
                    {detail.country
                      ? `${getCountryName(detail.country)} (${detail.country})`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Type
                  </p>
                  <Badge variant="outline">{detail.type}</Badge>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    HTTP status
                  </p>
                  <p className="tabular-nums">{detail.statusCode ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    User agent
                  </p>
                  <p className="break-words text-xs leading-relaxed text-muted-foreground">
                    {detail.userAgent ?? '—'}
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
