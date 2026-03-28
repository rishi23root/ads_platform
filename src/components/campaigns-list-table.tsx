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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { campaignScheduleBrief, campaignStatusBadgeVariant } from '@/lib/campaign-display';

export interface CampaignListRow {
  id: string;
  name: string;
  campaignType: string;
  targetAudience: string;
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

function audienceHint(audience: string): string {
  return audience === 'new_users'
    ? 'Target audience: new users (within 7 days)'
    : 'Target audience: all users';
}

export function CampaignsListTable({ campaigns, isAdmin }: CampaignsListTableProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const goToCampaign = React.useCallback(
    (id: string) => {
      router.push(`/campaigns/${id}`);
    },
    [router]
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all' && c.campaignType !== typeFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [campaigns, search, typeFilter, statusFilter]);

  const colCount = isAdmin ? 7 : 6;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="campaign-search" className="sr-only">
            Search campaigns by name
          </label>
          <Input
            id="campaign-search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
            autoComplete="off"
          />
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
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="relative z-0 rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[9rem]">Schedule</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Targets</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-8 text-center text-muted-foreground">
                  No campaigns yet. {isAdmin && 'Create your first campaign.'}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-8 text-center text-muted-foreground">
                  No campaigns match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
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
                        {audienceHint(c.targetAudience)}
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
                  <TableCell className="text-sm text-muted-foreground">
                    {campaignScheduleBrief(c.startDate, c.endDate)}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {c.frequencyType.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {(c.campaignType === 'notification' || c.campaignType === 'redirect') &&
                      (c.platformIds?.length ?? 0) === 0
                        ? 'All platforms'
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
                          apiPath={`/api/campaigns/${c.id}`}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
