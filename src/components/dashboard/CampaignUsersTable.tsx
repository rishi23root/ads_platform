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
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EndUserIdCell } from '@/components/enduser-id-cell';
import { HumanReadableDate } from '@/components/human-readable-date';
import { ExportCampaignUsersCsvButton } from '@/components/export-campaign-users-csv-button';
import { IconRefresh, IconExternalLink } from '@tabler/icons-react';
import { dataTableHeadMutedClassName } from '@/lib/admin-ui';
import { getCountryName } from '@/lib/countries';

interface CampaignUserRow {
  userIdentifier: string;
  endUserUuid: string | null;
  email: string | null;
  plan: 'trial' | 'paid' | null;
  country: string | null;
  banned: boolean | null;
  eventCount: number;
  lastSeenAt: string | null;
}

interface CampaignUsersTableProps {
  campaignId: string;
}

const PAGE_SIZE = 25;

export function CampaignUsersTable({ campaignId }: CampaignUsersTableProps) {
  const [page, setPage] = React.useState(1);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [users, setUsers] = React.useState<CampaignUserRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [campaignId]);

  React.useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      `/api/campaigns/${campaignId}/users?page=${page}&pageSize=${PAGE_SIZE}`,
      { signal: ac.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then(
        (data: {
          users: CampaignUserRow[];
          totalCount: number;
          totalPages: number;
        }) => {
          setUsers(data.users);
          setTotalCount(data.totalCount);
          setTotalPages(data.totalPages);
        }
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load users');
        setUsers([]);
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

  const colCount = 6;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            Campaign users ({loading ? '…' : totalCount.toLocaleString()})
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every user we&apos;ve served through this campaign, sorted by most
            events first.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!loading && (totalPages > 0 || totalCount > 0) && (
            <TablePagination
              mode="button"
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
          <ExportCampaignUsersCsvButton
            campaignId={campaignId}
            className="h-9 w-9 min-h-9 min-w-9"
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setRefreshNonce((n) => n + 1)}
            disabled={loading}
            aria-label="Refresh users"
            className="h-9 w-9 min-h-9 min-w-9"
          >
            <IconRefresh className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DataTableSurface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={dataTableHeadMutedClassName}>App user</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Email</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Plan</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Country</TableHead>
              <TableHead className={dataTableHeadMutedClassName}>Last seen</TableHead>
              <TableHead className={`${dataTableHeadMutedClassName} text-right`}>
                Events
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center py-12 text-muted-foreground text-sm"
                >
                  No users served yet. End users will appear here once events
                  are recorded for this campaign.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.userIdentifier}>
                  <TableCell>
                    <EndUserIdCell
                      userIdentifier={u.userIdentifier}
                      profileHref={u.endUserUuid ? `/users/${u.endUserUuid}` : null}
                    />
                  </TableCell>
                  <TableCell className="text-sm overflow-hidden">
                    {u.email ? (
                      u.endUserUuid ? (
                        <Link
                          href={`/users/${u.endUserUuid}`}
                          className="group inline-flex max-w-[220px] items-center gap-1 truncate hover:text-primary hover:underline"
                          title={u.email}
                        >
                          <span className="truncate">{u.email}</span>
                          <IconExternalLink className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block max-w-[220px] truncate">
                              {u.email}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm break-all">
                            {u.email}
                          </TooltipContent>
                        </Tooltip>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.plan ? (
                      <Badge variant="secondary" className="capitalize">
                        {u.plan}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.country ? (
                      <span>
                        {getCountryName(u.country)}{' '}
                        <span className="text-muted-foreground">({u.country})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastSeenAt ? (
                      <HumanReadableDate date={new Date(u.lastSeenAt)} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {u.eventCount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTableSurface>
    </section>
  );
}
