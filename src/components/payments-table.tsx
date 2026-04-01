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
}

export function PaymentsTable({ payments, onChanged, allowDelete = true }: PaymentsTableProps) {
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
      <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
        No payments recorded for this user.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            {allowDelete ? <TableHead className="w-[72px]" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {new Date(p.paymentDate).toLocaleString()}
              </TableCell>
              <TableCell className="tabular-nums text-sm">{formatAmount(p.amount, p.currency)}</TableCell>
              <TableCell className="capitalize text-sm">{p.status}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate">
                {p.description ?? '—'}
              </TableCell>
              {allowDelete ? (
                <TableCell className="text-right">
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
    </div>
  );
}
