'use client';

import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const ChartAreaInteractiveDynamic = nextDynamic(
  () => import('@/components/chart-area-interactive').then((m) => m.ChartAreaInteractive),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <Skeleton className="h-[312px] w-full rounded-lg" />
      </div>
    ),
  }
);
