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
import { Checkbox } from '@/components/ui/checkbox';
import { EndUserRowActions } from '@/components/end-user-row-actions';
import { HumanReadableDate } from '@/components/human-readable-date';
import { UserIdentityCell } from '@/components/user-identity-cell';
import type { EndUserListRow } from '@/lib/end-users-dashboard';
import type { ExtensionPlanValue } from '@/lib/extension-user-subscription';
import {
  computeExtensionDaysLeft,
  computeTrialEndDateFromStart,
  formatExtensionDaysLeftCell,
} from '@/lib/extension-user-subscription';
import { cn } from '@/lib/utils';

function rowPlan(plan: string): ExtensionPlanValue {
  return plan === 'paid' ? 'paid' : 'trial';
}

/** One rhythm for every header and cell — browsers size columns from content. */
const cell = 'px-2 py-2 align-middle';

/**
 * On `w-full` auto tables, very short values (—, 0) otherwise pull apart neighbors.
 * `w-[1%]` is a well-supported “stay content-sized” hint, not a fixed pixel gutter.
 */
const tightCol = 'w-[1%] whitespace-nowrap';

function daysLeftLabel(formatted: string): string {
  if (formatted === '—') return '—';
  const n = parseInt(formatted, 10);
  if (!Number.isFinite(n)) return formatted;
  return `${n}\u00a0${n === 1 ? 'day' : 'days'}`;
}

export type UsersTableSelection = {
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
};

interface UsersTableProps {
  rows: EndUserListRow[];
  isAdmin?: boolean;
  selection?: UsersTableSelection;
}

export function UsersTable({ rows, isAdmin = false, selection }: UsersTableProps) {
  const colCount = selection ? 11 : 10;

  const pageIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selection?.selectedIds.has(id));
  const somePageSelected =
    pageIds.length > 0 && pageIds.some((id) => selection?.selectedIds.has(id));

  const headerChecked: boolean | 'indeterminate' = allPageSelected
    ? true
    : somePageSelected
      ? 'indeterminate'
      : false;

  return (
    <div className="w-full overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            {selection ? (
              <TableHead className={cn(cell, 'w-[1%] pl-3')}>
                <span className="flex min-h-8 min-w-8 items-center justify-center">
                  <Checkbox
                    checked={headerChecked}
                    onCheckedChange={(v) => selection.onTogglePage(v === true)}
                    aria-label="Select all users on this page"
                  />
                </span>
              </TableHead>
            ) : null}
            <TableHead className={cn(cell, 'text-left font-medium')}>User</TableHead>
            <TableHead className={cn(cell, 'font-medium')}>Plan</TableHead>
            <TableHead className={cn(cell, 'font-medium')}>Banned</TableHead>
            <TableHead className={cn(cell, tightCol, 'font-medium')}>Country</TableHead>
            <TableHead className={cn(cell, tightCol, 'text-right font-medium tabular-nums')}>
              Impressions
            </TableHead>
            <TableHead className={cn(cell, 'text-left font-medium')}>Start date</TableHead>
            <TableHead className={cn(cell, 'text-left font-medium')}>End date</TableHead>
            <TableHead className={cn(cell, 'text-left font-medium')}>Last session</TableHead>
            <TableHead className={cn(cell, 'text-right font-medium tabular-nums')}>Days left</TableHead>
            <TableHead className={cn(cell, 'text-right font-medium')}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground">
                No users match your filters. Try adjusting your filters or removing them.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((v) => {
              const plan = rowPlan(v.plan);
              const inferredEnd =
                v.endDate == null && plan === 'trial'
                  ? computeTrialEndDateFromStart(v.startDate)
                  : null;
              const effectiveEndDate = v.endDate ?? inferredEnd;
              const daysLeft = formatExtensionDaysLeftCell(
                computeExtensionDaysLeft({
                  endDate: v.endDate,
                  plan,
                  startDate: v.startDate,
                })
              );
              return (
                <TableRow key={v.id} className={cn(v.banned && 'bg-destructive/5')}>
                  {selection ? (
                    <TableCell className={cn(cell, 'pl-3')}>
                      <span className="flex min-h-8 min-w-8 items-center justify-center">
                        <Checkbox
                          checked={selection.selectedIds.has(v.id)}
                          onCheckedChange={(checked) =>
                            selection.onToggleRow(v.id, checked === true)
                          }
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
                  <TableCell className={cn(cell, 'whitespace-nowrap capitalize text-sm')}>
                    {v.plan}
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
                    <HumanReadableDate date={new Date(v.startDate)} />
                  </TableCell>
                  <TableCell className={cn(cell, 'text-sm text-muted-foreground whitespace-normal')}>
                    {effectiveEndDate ? (
                      <HumanReadableDate date={new Date(effectiveEndDate)} />
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(cell, 'text-sm text-muted-foreground whitespace-normal')}>
                    {v.lastSessionAt ? (
                      <HumanReadableDate date={new Date(v.lastSessionAt)} />
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(cell, 'text-right tabular-nums text-sm text-muted-foreground')}
                  >
                    {daysLeftLabel(daysLeft)}
                  </TableCell>
                  <TableCell className={cn(cell, 'text-right whitespace-nowrap')}>
                    <EndUserRowActions
                      userId={v.id}
                      email={v.email}
                      identifier={v.identifier}
                      canDelete={isAdmin}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
