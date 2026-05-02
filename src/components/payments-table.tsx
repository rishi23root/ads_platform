'use client';

import { useCallback, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { dataTableHeadMutedClassName } from '@/lib/admin-ui';
import { HumanReadableDate } from '@/components/human-readable-date';
import { Button } from '@/components/ui/button';
import type { PaymentRow } from '@/db/schema';
import { IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

interface PaymentsTableProps {
  payments: PaymentRow[];
  onChanged?: () => void;
  allowDelete?: boolean;
  /** When true, only the scroll + table (parent supplies the outer border). */
  embedded?: boolean;
}

export function PaymentsTable({
  payments,
  onChanged,
  allowDelete = true,
  embedded = false,
}: PaymentsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onDelete = useCallback(
    async (paymentId: string) => {
      if (!confirm('Delete this payment record?')) return;
      setDeletingId(paymentId);
      try {
        const res = await fetch(`/api/payments/${paymentId}`, { method: 'DELETE' });
        if (!res.ok) {
          toast.error('Could not delete payment');
          return;
        }
        toast.success('Payment deleted');
        onChanged?.();
      } finally {
        setDeletingId(null);
      }
    },
    [onChanged]
  );

  if (payments.length === 0) {
    return (
      <p
        className={`text-sm text-muted-foreground py-8 text-center ${embedded ? '' : 'border rounded-md'}`}
      >
        No payments recorded for this user.
      </p>
    );
  }

  const table = (
    <Table className={embedded ? 'w-full table-auto' : undefined}>
      <TableHeader>
        <TableRow className={embedded ? 'hover:bg-transparent' : undefined}>
          <TableHead className={embedded ? dataTableHeadMutedClassName : undefined}>Date</TableHead>
          <TableHead className={embedded ? dataTableHeadMutedClassName : undefined}>Amount</TableHead>
          <TableHead className={embedded ? dataTableHeadMutedClassName : undefined}>Status</TableHead>
          <TableHead className={embedded ? dataTableHeadMutedClassName : undefined}>Description</TableHead>
          {allowDelete ? (
            <TableHead
              className={embedded ? `${dataTableHeadMutedClassName} w-[72px]` : 'w-[72px]'}
            />
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="py-2 text-sm text-muted-foreground whitespace-normal align-top">
              <HumanReadableDate date={new Date(p.paymentDate)} dense />
            </TableCell>
            <TableCell className="py-2 tabular-nums text-sm">{formatAmount(p.amount, p.currency)}</TableCell>
            <TableCell className="py-2 capitalize text-sm">{p.status}</TableCell>
            <TableCell className="py-2 text-sm text-muted-foreground max-w-[280px] truncate">
              {p.description ?? '—'}
            </TableCell>
            {allowDelete ? (
              <TableCell className="py-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  disabled={deletingId === p.id}
                  onClick={() => onDelete(p.id)}
                  aria-label="Delete payment"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (embedded) {
    return <div className="w-full overflow-x-auto">{table}</div>;
  }

  return (
    <DataTableSurface>
      <div className="overflow-x-auto">{table}</div>
    </DataTableSurface>
  );
}
