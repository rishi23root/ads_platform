'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartDataPoint {
  date: string;
  impressions: number;
  users: number;
}

const chartConfig = {
  impressions: { label: 'Impressions', color: 'var(--chart-1)' },
  users: { label: 'Users', color: 'var(--chart-2)' },
} satisfies ChartConfig;

interface ActivityChartProps {
  data: ChartDataPoint[];
  loading: boolean;
  error: string | null;
  /** When true, chart fills parent (use inside flex column with flex-1). */
  fillHeight?: boolean;
}

export function ActivityChart({ data, loading, error, fillHeight = false }: ActivityChartProps) {
  const chartH = fillHeight
    ? 'aspect-auto h-full min-h-[200px] w-full min-h-0 flex-1 [&_.recharts-legend-wrapper]:!pb-0'
    : 'aspect-auto h-[200px] w-full [&_.recharts-legend-wrapper]:!pb-0';

  if (loading && (!data || data.length === 0)) {
    return <Skeleton className={cn(fillHeight ? 'h-full min-h-[200px] flex-1' : 'h-[200px]', 'w-full rounded-lg')} />;
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center border border-dashed text-sm text-muted-foreground',
          fillHeight ? 'h-full min-h-[200px] flex-1' : 'h-[200px]'
        )}
      >
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center border border-dashed text-sm text-muted-foreground',
          fillHeight ? 'h-full min-h-[200px] flex-1' : 'h-[200px]'
        )}
      >
        No activity for this period
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className={chartH}>
      <AreaChart data={data} margin={{ top: 12, left: 0, right: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="fillImpressions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-impressions)" stopOpacity={1} />
            <stop offset="95%" stopColor="var(--color-impressions)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-users)" stopOpacity={1} />
            <stop offset="95%" stopColor="var(--color-users)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value) =>
            new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => value.toLocaleString()}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) =>
                new Date(value).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
              indicator="dot"
            />
          }
        />
        <ChartLegend
          verticalAlign="bottom"
          content={<ChartLegendContent className="!pt-1.5 !pb-0 gap-x-3 gap-y-1" />}
        />
        <Area
          dataKey="impressions"
          type="natural"
          fill="url(#fillImpressions)"
          stroke="var(--color-impressions)"
        />
        <Area
          dataKey="users"
          type="natural"
          fill="url(#fillUsers)"
          stroke="var(--color-users)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
