'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { IconPencil } from '@tabler/icons-react';
import {
  campaignScheduleBrief,
  campaignScheduleTableTextColorClass,
  campaignStatusBadgeVariant,
  isCampaignActiveButScheduleEnded,
} from '@/lib/campaign-display';
import { dataTableHeadMutedClassName } from '@/lib/admin-ui';
import { cn } from '@/lib/utils';

export interface RecentCampaignRow {
  id: string;
  name: string;
  campaignType: string;
  status: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  impressions: number;
}

interface RecentCampaignsTableProps {
  campaigns: RecentCampaignRow[];
  isAdmin: boolean;
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
    el.closest('a[href], button, input, select, textarea, [role="button"], [role="link"]')
  );
}

export function RecentCampaignsTable({ campaigns, isAdmin }: RecentCampaignsTableProps) {
  const router = useRouter();

  const goToCampaign = React.useCallback(
    (id: string) => {
      router.push(`/campaigns/${id}`);
    },
    [router]
  );

  return (
    <div className="w-full overflow-x-auto">
      <Table className="w-full table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className={dataTableHeadMutedClassName}>Name</TableHead>
            <TableHead className={dataTableHeadMutedClassName}>Type</TableHead>
            <TableHead className={dataTableHeadMutedClassName}>Status</TableHead>
            <TableHead className={dataTableHeadMutedClassName}>Schedule</TableHead>
            <TableHead
              className={cn(dataTableHeadMutedClassName, 'text-right tabular-nums')}
            >
              Impressions
            </TableHead>
            {isAdmin && (
              <TableHead className={cn(dataTableHeadMutedClassName, 'text-right')}>
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 6 : 5}
                className="py-8 text-center text-muted-foreground"
              >
                No campaigns yet.
                {isAdmin
                  ? ' Create your first campaign to start delivering ads and notifications.'
                  : ' Campaigns created by your team will appear here.'}
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((c) => {
              const scheduleLabel = campaignScheduleBrief(c.startDate, c.endDate);
              const schedulePastEndWhileActive = isCampaignActiveButScheduleEnded(
                c.status,
                c.endDate
              );
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  aria-label={`Open campaign ${c.name}`}
                  onClick={(e) => {
                    if (isWithinInteractiveControl(e.target)) return;
                    goToCampaign(c.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goToCampaign(c.id);
                    }
                  }}
                >
                  <TableCell className="py-2 overflow-hidden font-medium min-w-0">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-foreground block truncate hover:underline underline-offset-4"
                      title={c.name}
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="py-2 overflow-hidden">
                    <Badge variant="outline">{c.campaignType}</Badge>
                  </TableCell>
                  <TableCell className="py-2 overflow-hidden">
                    <Badge variant={campaignStatusBadgeVariant(c.status)} className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`py-2 text-sm ${campaignScheduleTableTextColorClass(c.status, c.endDate)}`}
                    title={
                      schedulePastEndWhileActive
                        ? 'Schedule ended; status is still active'
                        : undefined
                    }
                  >
                    {scheduleLabel}
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums text-sm text-muted-foreground">
                    {c.impressions.toLocaleString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/campaigns/${c.id}/edit`} aria-label="Edit campaign">
                            <IconPencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
