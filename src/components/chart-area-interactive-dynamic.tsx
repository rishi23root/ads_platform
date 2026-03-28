'use client';

import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const ChartAreaInteractiveDynamic = nextDynamic(
  () => import('@/components/chart-area-interactive').then((m) => m.ChartAreaInteractive),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-border bg-card/40 p-4 shadow-none">
        <Skeleton className="h-[312px] w-full rounded-lg" />
      </div>
    ),
  }
);
