'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HumanReadableDate } from '@/components/human-readable-date';
import { Badge } from '@/components/ui/badge';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import type { PaymentListRow } from '@/lib/payments-types';

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/20';
    case 'pending':
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20';
    case 'failed':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'refunded':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return '';
  }
}

interface AllPaymentsTableProps {
  rows: PaymentListRow[];
}

export function AllPaymentsTable({ rows }: AllPaymentsTableProps) {
  const colCount = 5;

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableCaption className="sr-only">
          Payments list with date, user, amount, status, and description.
        </TableCaption>
        <TableHeader>
          <TableRow>
                       <TableHead scope="col" className="min-w-[128px] max-w-[200px]">
              Payment date
            </TableHead>
            <TableHead scope="col" className="min-w-[160px]">
              User
            </TableHead>
            <TableHead scope="col" className="min-w-[100px]">
              Amount
            </TableHead>
            <TableHead scope="col" className="min-w-[96px]">
              Status
            </TableHead>
            <TableHead scope="col" className="min-w-[200px] max-w-[320px]">
              Description
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyTableRow
              colSpan={colCount}
              title="No payments match your filters"
              description="Try changing the search or status, or use Clear in the filters panel."
            />
          ) : (
            rows.map((p) => {
              const desc = p.description ?? '';
              const descTitle = desc.length > 80 ? desc : undefined;
              return (
                <TableRow key={p.id}>
                                   <TableCell className="text-sm text-muted-foreground min-w-0 align-top whitespace-normal">
                    <HumanReadableDate date={new Date(p.paymentDate)} dense />
                  </TableCell>
                  <TableCell className="text-sm min-w-0">
                    <Link
                      href={`/users/${p.endUserId}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                    >
                      {p.endUserName?.trim() || p.endUserEmail || 'Anonymous'}
                    </Link>
                    {p.endUserName?.trim() ? (
                      <div className="text-xs text-muted-foreground truncate max-w-[240px] mt-0.5">
                        {p.endUserEmail ?? 'No email'}
                      </div>
                    ) : p.endUserEmail ? (
                      <div className="text-xs text-muted-foreground truncate max-w-[240px] mt-0.5">
                        {p.endUserEmail}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm whitespace-nowrap">
                    {formatAmount(p.amount, p.currency)}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    <Badge variant="outline" className={statusBadgeClass(p.status)}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[280px] min-w-0">
                    <span className="block truncate" title={descTitle}>
                      {p.description ?? '—'}
                    </span>
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
