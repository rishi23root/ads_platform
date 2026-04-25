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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IconPencil, IconSearch, IconX } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import {
  campaignAudienceLabel,
  campaignFrequencyTypeDisplayName,
  campaignScheduleBrief,
  campaignScheduleTableTextColorClass,
  campaignStatusBadgeVariant,
  isCampaignActiveButScheduleEnded,
} from '@/lib/campaign-display';

/** Idle delay before applying name/ID filter (matches users quick search). */
const SEARCH_DEBOUNCE_MS = 500;

export interface CampaignListRow {
  id: string;
  name: string;
  campaignType: string;
  targetAudience: string;
  /** When set, campaign delivery is scoped to this list. */
  targetListId: string | null;
  /** Resolved name for display (null if list was deleted). */
  targetListName: string | null;
  frequencyType: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  platformIds: string[];
  countryCodes?: string[];
  adId: string | null;
  notificationId: string | null;
  redirectId: string | null;
}

interface CampaignsListTableProps {
  campaigns: CampaignListRow[];
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
    el.closest(
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="combobox"]'
    )
  );
}

function audienceHint(targetListName: string | null, audience: string): string {
  if (targetListName) return `Audience list: ${targetListName}`;
  return audience === 'new_users'
    ? 'Audience: new users (within 7 days)'
    : 'Audience: all users';
}

export function CampaignsListTable({ campaigns, isAdmin }: CampaignsListTableProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  React.useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setDebouncedSearch('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const goToCampaign = React.useCallback(
    (id: string) => {
      router.push(`/campaigns/${id}`);
    },
    [router]
  );

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q))
        return false;
      if (typeFilter !== 'all' && c.campaignType !== typeFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [campaigns, debouncedSearch, typeFilter, statusFilter]);

  const showClearSearch = search.trim().length > 0;
  const colCount = isAdmin ? 8 : 7;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="campaign-search" className="sr-only">
            Search campaigns by name or ID
          </label>
          <div className="relative max-w-md">
            <IconSearch
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="campaign-search"
              placeholder="Name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={
                showClearSearch ? 'w-full pl-9 pr-10' : 'w-full pl-9'
              }
              autoComplete="off"
            />
            {showClearSearch ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <IconX className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <span id="filter-type-label" className="sr-only">
              Filter by campaign type
            </span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="w-full sm:w-[160px]"
                aria-labelledby="filter-type-label"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="ads">Ads</SelectItem>
                <SelectItem value="popup">Popup</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="redirect">Redirect</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span id="filter-status-label" className="sr-only">
              Filter by status
            </span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-full sm:w-[160px]"
                aria-labelledby="filter-status-label"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                {isAdmin && <SelectItem value="deleted">Deleted</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DataTableSurface variant="delivery" className="relative z-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[9rem]">Schedule</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead className="min-w-[10rem]">Audience list</TableHead>
              <TableHead>Targets</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <EmptyTableRow
                colSpan={colCount}
                title="No campaigns yet"
                description={
                  isAdmin
                    ? 'A campaign decides what to show, who sees it, and when.'
                    : 'Your team has not created any campaigns yet.'
                }
                action={
                  isAdmin ? (
                    <Button asChild size="sm">
                      <Link href="/campaigns/new">Create your first campaign</Link>
                    </Button>
                  ) : null
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyTableRow
                colSpan={colCount}
                title="No campaigns match your filters"
                description="Try changing the search, type, or status."
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setTypeFilter('all');
                      setStatusFilter('all');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              filtered.map((c) => {
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
                    <TableCell className="font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={`/campaigns/${c.id}`}
                            className="hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                          >
                            {c.name}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs text-balance">
                          {audienceHint(c.targetListName, c.targetAudience)}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.campaignType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={campaignStatusBadgeVariant(c.status)}
                        className="capitalize"
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-sm ${campaignScheduleTableTextColorClass(c.status, c.endDate)}`}
                      title={
                        schedulePastEndWhileActive
                          ? 'Schedule ended; status is still active'
                          : undefined
                      }
                    >
                      {campaignScheduleBrief(c.startDate, c.endDate)}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {campaignFrequencyTypeDisplayName(c.frequencyType)}
                    </TableCell>
                    <TableCell className="max-w-[14rem]">
                      {c.targetListId ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/target-lists/${c.targetListId}`}
                              className="line-clamp-2 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {c.targetListName ?? 'Unknown list'}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            Audience list: {c.targetListName ?? 'Unknown list'} — open list
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground text-sm">
                              {campaignAudienceLabel(c.targetAudience)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs text-balance">
                            {audienceHint(null, c.targetAudience)}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">
                        {(c.campaignType === 'notification' || c.campaignType === 'redirect') &&
                        (c.platformIds?.length ?? 0) === 0
                          ? 'All domains'
                          : `${c.platformIds?.length ?? 0} platforms`}
                        {(c.countryCodes?.length ?? 0) > 0
                          ? ` · ${c.countryCodes!.length} countries`
                          : ' · All countries'}
                        {(c.campaignType === 'ads' || c.campaignType === 'popup') &&
                          (c.adId ? ' · 1 ad' : '')}
                        {c.campaignType === 'notification' && (c.notificationId ? ' · 1 notification' : '')}
                        {c.campaignType === 'redirect' && (c.redirectId ? ' · 1 redirect' : '')}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/campaigns/${c.id}/edit`} className="size-9">
                              <IconPencil className="h-4 w-4" />
                              <span className="sr-only">Edit {c.name}</span>
                            </Link>
                          </Button>
                          <DeleteButton
                            name={c.name}
                            entityType="campaign"
                            campaignStatus={c.status}
                            apiPath={`/api/campaigns/${c.id}`}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
        </TableBody>
      </Table>
      </DataTableSurface>
    </div>
  );
}
