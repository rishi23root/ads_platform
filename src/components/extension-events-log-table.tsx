'use client';

import { CopyableIdCell } from '@/components/copyable-id-cell';
import { HumanReadableDate } from '@/components/human-readable-date';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dataTableHeadMutedClassName } from '@/lib/admin-ui';
import { getCountryName } from '@/lib/countries';
import type { EventLogRow } from '@/lib/events-dashboard';
import { cn } from '@/lib/utils';

const typeColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ad: 'default',
  notification: 'secondary',
  popup: 'outline',
  request: 'secondary',
  redirect: 'outline',
  visit: 'secondary',
};

export type ExtensionEventsLogTableRow = Omit<EventLogRow, 'createdAt'> & {
  createdAt: Date | string;
};

const COLGROUP = (
  <colgroup>
    <col style={{ width: 'auto' }} />
    <col style={{ width: 'auto' }} />
    <col style={{ width: 'auto' }} />
    <col style={{ width: 'auto' }} />
    <col style={{ width: 'auto' }} />
    <col style={{ width: '80px' }} />
    <col style={{ width: 'minmax(120px, 1fr)' }} />
    <col style={{ width: '90px' }} />
    <col style={{ width: '170px' }} />
  </colgroup>
);

const th = (extra?: string) => cn(dataTableHeadMutedClassName, extra);

export type ExtensionEventsLogTableProps = {
  rows: ExtensionEventsLogTableRow[];
  /** When `rows` is empty, show this message in a single full-width cell (e.g. Events page). */
  emptyMessage?: string;
  /** Optional header row classes (e.g. `hover:bg-transparent` for embedded tables). */
  headerRowClassName?: string;
};

export function ExtensionEventsLogTable({
  rows,
  emptyMessage,
  headerRowClassName,
}: ExtensionEventsLogTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <Table className="w-full table-auto">
        {COLGROUP}
        <TableHeader>
          <TableRow className={headerRowClassName ?? undefined}>
            <TableHead className={th()}>User identifier</TableHead>
            <TableHead className={th()}>Email</TableHead>
            <TableHead className={th()}>Plan</TableHead>
            <TableHead className={th()}>Campaign</TableHead>
            <TableHead className={th()}>Domain</TableHead>
            <TableHead className={th()}>Country</TableHead>
            <TableHead className={th()}>User agent</TableHead>
            <TableHead className={th()}>Type</TableHead>
            <TableHead className={th()}>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && emptyMessage ? (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="py-2 overflow-hidden">
                  <CopyableIdCell
                    value={log.userIdentifier}
                    truncateLength={12}
                    copyLabel="User identifier copied to clipboard"
                    href={log.endUserUuid ? `/users/${log.endUserUuid}` : undefined}
                  />
                </TableCell>
                <TableCell className="py-2 overflow-hidden text-sm">
                  {log.email ? (
                    <span className="truncate block max-w-[180px]" title={log.email}>
                      {log.email}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-2 overflow-hidden text-sm">
                  {log.plan ? (
                    <Badge variant="outline" className="font-normal capitalize">
                      {log.plan}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-2 overflow-hidden">
                  {log.campaignId ? (
                    <CopyableIdCell
                      value={log.campaignId}
                      href={`/campaigns/${log.campaignId}`}
                      truncateLength={8}
                      copyLabel="Campaign ID copied to clipboard"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-2 overflow-hidden">
                  <span className="truncate block" title={log.domain ?? ''}>
                    {log.domain ?? '—'}
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
                <TableCell className="py-2 overflow-hidden text-sm text-muted-foreground max-w-[220px]">
                  <span
                    className="line-clamp-2 font-mono text-xs"
                    title={log.userAgent ?? undefined}
                  >
                    {log.userAgent ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="py-2 overflow-hidden">
                  <Badge variant={typeColors[log.type] ?? 'secondary'}>{log.type}</Badge>
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground min-w-0">
                  <HumanReadableDate date={new Date(log.createdAt)} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
