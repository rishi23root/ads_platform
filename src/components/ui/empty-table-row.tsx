import * as React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface EmptyTableRowProps {
  colSpan: number;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

// Shared "no rows" row for list tables. Use for both "nothing here yet" and
// "no matches for filters" — pass a Clear filters action for the latter.
export function EmptyTableRow({
  colSpan,
  title,
  description,
  action,
  className,
}: EmptyTableRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className={cn('px-4 py-12 text-center text-sm', className)}
      >
        <div className="app-rise-in mx-auto flex max-w-prose flex-col items-center gap-2 text-muted-foreground">
          <p className="font-medium text-foreground">{title}</p>
          {description ? <p className="leading-relaxed">{description}</p> : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
