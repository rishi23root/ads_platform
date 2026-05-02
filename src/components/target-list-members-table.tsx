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
import { Checkbox } from '@/components/ui/checkbox';
import { HumanReadableDate } from '@/components/human-readable-date';
import { UserIdentityCell } from '@/components/user-identity-cell';
import type { TargetListMemberRow, TargetListMemberTabSource } from '@/lib/target-list-members-query';
import type { ExtensionPlanValue } from '@/lib/extension-user-subscription';
import {
  computeExtensionDaysLeft,
  computeTrialEndDateFromStart,
  formatExtensionDaysLeftCell,
} from '@/lib/extension-user-subscription';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { cn } from '@/lib/utils';
import { IconFilter, IconUserMinus, IconUserPlus } from '@tabler/icons-react';
import { toast } from 'sonner';

function rowPlan(plan: string): ExtensionPlanValue {
  return plan === 'paid' ? 'paid' : 'trial';
}

const cell = 'px-2 py-2 align-middle';
const tightCol = 'w-[1%] whitespace-nowrap';

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function daysLeftLabel(formatted: string): string {
  if (formatted === '—') return '—';
  const n = parseInt(formatted, 10);
  if (!Number.isFinite(n)) return formatted;
  return `${n}\u00a0${n === 1 ? 'day' : 'days'}`;
}

function SourceBadge({ kind }: { kind: TargetListMemberRow['memberSource'] }) {
  if (kind === 'explicit') {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <IconUserPlus className="h-3 w-3 shrink-0" aria-hidden />
        Explicit
      </Badge>
    );
  }
  if (kind === 'filter') {
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        <IconFilter className="h-3 w-3 shrink-0" aria-hidden />
        Filter
      </Badge>
    );
  }
  if (kind === 'both') {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <IconUserPlus className="h-3 w-3 shrink-0" aria-hidden />
        <IconFilter className="h-3 w-3 shrink-0" aria-hidden />
        Both
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1 font-normal">
      <IconUserMinus className="h-3 w-3 shrink-0" aria-hidden />
      Excluded
    </Badge>
  );
}

export function TargetListMembersTable({
  listId,
  source,
  rows,
  isAdmin,
}: {
  listId: string;
  source: TargetListMemberTabSource;
  rows: TargetListMemberRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(rows.map((r) => r.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [rows]);

  const selection = isAdmin
    ? {
        selectedIds,
        onToggleRow: (id: string, checked: boolean) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          });
        },
        onTogglePage: (checked: boolean) => {
          const pageIds = rows.map((r) => r.id);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) for (const id of pageIds) next.add(id);
            else for (const id of pageIds) next.delete(id);
            return next;
          });
        },
      }
    : undefined;

  const pageIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const allPageSelected =
    selection && pageIds.length > 0 && pageIds.every((id) => selection.selectedIds.has(id));
  const somePageSelected =
    selection && pageIds.length > 0 && pageIds.some((id) => selection.selectedIds.has(id));
  const headerChecked: boolean | 'indeterminate' =
    selection && allPageSelected ? true : selection && somePageSelected ? 'indeterminate' : false;

  const selectedArr = React.useMemo(() => [...selectedIds], [selectedIds]);

  const runRemoveFromList = async () => {
    if (selectedArr.length === 0) return;
    setPending(true);
    try {
      const res = await fetch(`/api/target-lists/${listId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedArr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Update failed');
      toast.success(`Updated list for ${selectedArr.length} user(s)`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  };

  const runUnexclude = async () => {
    if (selectedArr.length === 0) return;
    setPending(true);
    try {
      const res = await fetch(`/api/target-lists/${listId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedArr, unexcludeOnly: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Update failed');
      toast.success(`Restored ${selectedArr.length} user(s)`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  };

  const colCount = selection ? 12 : 11;

  const showBulk = isAdmin && selectedArr.length > 0;

  return (
    <div className="space-y-3">
      {showBulk ? (
        <div
          className="motion-safe:transition-opacity flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
          role="region"
          aria-label="Bulk actions for selected members"
        >
          <span className="text-muted-foreground tabular-nums">{selectedArr.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            {source === 'excluded' ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8"
                disabled={pending}
                onClick={() => void runUnexclude()}
              >
                {pending ? '…' : 'Un-exclude'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8"
                disabled={pending}
                onClick={() => void runRemoveFromList()}
              >
                {pending ? '…' : 'Remove from list'}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <DataTableSurface variant="delivery" className="w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {selection ? (
                <TableHead className={cn(cell, 'w-[1%] pl-3')}>
                  <span className="flex min-h-8 min-w-8 items-center justify-center">
                    <Checkbox
                      checked={headerChecked}
                      onCheckedChange={(v) => selection.onTogglePage(v === true)}
                      aria-label="Select all members on this page"
                    />
                  </span>
                </TableHead>
              ) : null}
              <TableHead className={cn(cell, 'text-left text-muted-foreground text-xs font-normal')}>
                User
              </TableHead>
              <TableHead className={cn(cell, 'text-muted-foreground text-xs font-normal')}>Plan</TableHead>
              <TableHead className={cn(cell, 'text-muted-foreground text-xs font-normal')}>Source</TableHead>
              <TableHead className={cn(cell, 'text-muted-foreground text-xs font-normal')}>Banned</TableHead>
              <TableHead className={cn(cell, tightCol, 'text-muted-foreground text-xs font-normal')}>
                Country
              </TableHead>
              <TableHead
                className={cn(cell, tightCol, 'text-right text-muted-foreground text-xs font-normal tabular-nums')}
              >
                Impressions
              </TableHead>
              <TableHead className={cn(cell, 'text-left text-muted-foreground text-xs font-normal')}>
                Start date
              </TableHead>
              <TableHead className={cn(cell, 'text-left text-muted-foreground text-xs font-normal')}>
                End date
              </TableHead>
              <TableHead className={cn(cell, 'text-left text-muted-foreground text-xs font-normal')}>
                Last session
              </TableHead>
              <TableHead
                className={cn(cell, 'text-right text-muted-foreground text-xs font-normal tabular-nums')}
              >
                Days left
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-12 text-center text-muted-foreground">
                  {source === 'all' ? (
                    <span>
                      This list has no qualifying users yet.{' '}
                      <Link href="/users" className="text-primary underline-offset-4 hover:underline">
                        Go to Users
                      </Link>{' '}
                      to add some, or loosen the filter.
                    </span>
                  ) : source === 'explicit' ? (
                    <span>
                      No explicit members. Add users from the Users page using &quot;Add to audience list&quot;.
                    </span>
                  ) : source === 'filter' ? (
                    <span>No users match the filter. Try widening the filter on Edit.</span>
                  ) : (
                    <span>No excluded users.</span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => {
                const plan = rowPlan(v.plan);
                const inferredEnd =
                  v.endDate == null && plan === 'trial'
                    ? computeTrialEndDateFromStart(asDate(v.startDate))
                    : null;
                const effectiveEndDate = v.endDate ? asDate(v.endDate) : inferredEnd;
                const daysLeft = formatExtensionDaysLeftCell(
                  computeExtensionDaysLeft({
                    endDate: v.endDate ? asDate(v.endDate) : null,
                    plan,
                    startDate: asDate(v.startDate),
                  })
                );
                return (
                  <TableRow key={v.id} className={cn(v.banned && 'bg-destructive/5')}>
                    {selection ? (
                      <TableCell className={cn(cell, 'pl-3')}>
                        <span className="flex min-h-8 min-w-8 items-center justify-center">
                          <Checkbox
                            checked={selection.selectedIds.has(v.id)}
                            onCheckedChange={(checked) => selection.onToggleRow(v.id, checked === true)}
                            aria-label={`Select user ${v.email ?? v.identifier ?? v.id}`}
                          />
                        </span>
                      </TableCell>
                    ) : null}
                    <TableCell className={cn(cell, 'min-w-0')}>
                      <UserIdentityCell
                        endUserId={v.id}
                        identifier={v.identifier}
                        displayEmail={v.email}
                        displayName={v.name}
                      />
                    </TableCell>
                    <TableCell className={cn(cell, 'whitespace-nowrap capitalize text-sm')}>{v.plan}</TableCell>
                    <TableCell className={cell}>
                      <SourceBadge kind={v.memberSource} />
                    </TableCell>
                    <TableCell className={cell}>
                      <Badge variant={v.banned ? 'destructive' : 'secondary'} className="font-normal">
                        {v.banned ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(cell, tightCol)}>
                      {v.country ? (
                        <span className="uppercase">{v.country}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn(cell, tightCol, 'text-right tabular-nums text-sm')}>
                      {v.impressionCount}
                    </TableCell>
                    <TableCell className={cn(cell, 'text-sm text-muted-foreground whitespace-normal')}>
                      <HumanReadableDate date={asDate(v.startDate)} />
                    </TableCell>
                    <TableCell className={cn(cell, 'text-sm text-muted-foreground whitespace-normal')}>
                      {effectiveEndDate ? (
                        <HumanReadableDate date={effectiveEndDate} />
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn(cell, 'text-sm text-muted-foreground whitespace-normal')}>
                      {v.lastSessionAt ? (
                        <HumanReadableDate date={asDate(v.lastSessionAt)} />
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(cell, 'text-right tabular-nums text-sm text-muted-foreground')}
                    >
                      {daysLeftLabel(daysLeft)}
                    </TableCell>
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
