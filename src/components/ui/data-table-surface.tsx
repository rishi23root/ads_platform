import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const dataTableSurfaceVariants = cva(
  'app-fade-in min-w-0 border text-card-foreground overflow-hidden',
  {
    variants: {
      variant: {
        /** Primary list tables (users, events, payments, content libraries). */
        default: 'rounded-lg border-border bg-card/30 shadow-sm',
        /** Delivery / pipeline lists (campaigns, target lists): subtle primary accent. */
        delivery:
          'rounded-lg border-border bg-card/30 shadow-sm border-l-[3px] border-l-primary/35',
        /** Dashboard sections and inset panels (softer elevation). */
        embedded: 'rounded-xl border-border bg-card/40 shadow-none',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type DataTableSurfaceProps = React.ComponentProps<'div'> &
  VariantProps<typeof dataTableSurfaceVariants>;

export function DataTableSurface({
  className,
  variant,
  ...props
}: DataTableSurfaceProps) {
  return (
    <div
      data-slot="data-table-surface"
      className={cn(dataTableSurfaceVariants({ variant }), className)}
      {...props}
    />
  );
}

export { dataTableSurfaceVariants };
