'use client';

import * as React from 'react';
import Link from 'next/link';
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
import { DateDisplayToggleButton } from '@/components/date-display-toggle-button';
import { ExportCampaignLogsCsvButton } from '@/components/export-campaign-logs-csv-button';
import { HumanReadableDate } from '@/components/human-readable-date';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EndUserIdCell } from '@/components/enduser-id-cell';
import { IconExternalLink, IconRefresh } from '@tabler/icons-react';
import { dataTableHeadMutedClassName } from '@/lib/admin-ui';
import { getCountryName } from '@/lib/countries';

interface LogEntry {
  id: string;
  userIdentifier: string;
  endUserUuid: string | null;
  domain: string | null;
  type: string;
  createdAt: string;
  country: string | null;
  email: string | null;
  plan: string | null;
  userAgent: string | null;
}

interface CampaignLogsTableProps {
  campaignId: string;
}

function eventsDeepLinkForCampaign(campaignId: string): string {
  const q = new URLSearchParams({ campaignId });
  return `/events?${q.toString()}`;
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

export function CampaignLogsTable({ campaignId }: CampaignLogsTableProps) {
  const [page, setPage] = React.useState(1);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<LogEntry | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [campaignId]);

  React.useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${campaignId}/logs?page=${page}&pageSize=25`, {
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
  }, [campaignId, page, refreshNonce]);

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
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            Campaign logs ({loading ? '…' : totalCount.toLocaleString()})
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Activity from your users for this campaign. Select a row to see the full details.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
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
            <ExportCampaignLogsCsvButton
              campaignId={campaignId}
              className="h-9 w-9 min-h-9 min-w-9"
            />
            <DateDisplayToggleButton className="h-9 w-9 min-h-9 min-w-9" />
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-9 w-9 min-h-9 min-w-9"
                  asChild
                >
                  <Link
                    href={eventsDeepLinkForCampaign(campaignId)}
                    aria-label="View in Events"
                  >
                    <IconExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Opens Events with this campaign pre-selected
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <DataTableSurface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={dataTableHeadMutedClassName}>App user</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Email</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Domain</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Country</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Type</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Time</TableHead>
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
                  No activity yet. Events from your users will appear here.
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
                    <EndUserIdCell
                      userIdentifier={log.userIdentifier}
                      profileHref={
                        log.endUserUuid ? `/users/${log.endUserUuid}` : null
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm overflow-hidden">
                    {log.email ? (
                      <span className="truncate block max-w-[180px]" title={log.email}>
                        {log.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
                  <TableCell className="text-sm text-muted-foreground">
                    <HumanReadableDate date={new Date(log.createdAt)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTableSurface>

      <Sheet open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="pr-8">
                <SheetTitle className="break-words">Log event</SheetTitle>
                <SheetDescription>
                  <HumanReadableDate date={new Date(detail.createdAt)} />
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-4 px-4 pb-6 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    App user
                  </p>
                  <EndUserIdCell
                    userIdentifier={detail.userIdentifier}
                    profileHref={
                      detail.endUserUuid ? `/users/${detail.endUserUuid}` : null
                    }
                  />
                </div>
                {detail.email && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                      Email
                    </p>
                    <p className="break-all">{detail.email}</p>
                  </div>
                )}
                {detail.plan != null && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                      Plan
                    </p>
                    <Badge variant="secondary" className="capitalize">
                      {detail.plan}
                    </Badge>
                  </div>
                )}
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
