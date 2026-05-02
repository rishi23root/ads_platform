'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
  impressions: { label: 'Events', color: 'var(--chart-1)' },
  users: { label: 'Users', color: 'var(--chart-2)' },
} satisfies ChartConfig;

interface ActivityChartProps {
  data: ChartDataPoint[];
  loading: boolean;
  error: string | null;
  fillHeight?: boolean;
}

export function ActivityChart({ data, loading, error, fillHeight = false }: ActivityChartProps) {
  const chartH = fillHeight
    ? 'aspect-auto h-full min-h-[200px] w-full min-h-0 flex-1'
    : 'aspect-auto h-[200px] w-full';

  if (loading && (!data || data.length === 0)) {
    return (
      <Skeleton
        className={cn(fillHeight ? 'h-full min-h-[200px] flex-1' : 'h-[200px]', 'w-full rounded-lg')}
        aria-busy="true"
        aria-label="Loading activity chart"
      />
    );
  }

  if (error) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground',
          fillHeight ? 'h-full min-h-[200px] flex-1' : 'min-h-[200px]'
        )}
      >
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground',
          fillHeight ? 'h-full min-h-[200px] flex-1' : 'min-h-[200px]'
        )}
      >
        No activity for this period
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col',
        fillHeight && 'min-h-[220px] lg:min-h-0'
      )}
      role="region"
      aria-label="Daily campaign activity chart: events and unique users per UTC day"
    >
      <ChartContainer config={chartConfig} className={chartH}>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
          <defs>
            <linearGradient id="gradEvents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-impressions)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-impressions)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-users)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-users)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => value.toLocaleString()}
            width={36}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) =>
                  new Date(value).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                }
                indicator="dot"
              />
            }
          />
          {/* Events area rendered first (behind) so users line sits on top */}
          <Area
            dataKey="impressions"
            type="monotone"
            stroke="var(--color-impressions)"
            strokeWidth={1.5}
            fill="url(#gradEvents)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            dataKey="users"
            type="monotone"
            stroke="var(--color-users)"
            strokeWidth={1.5}
            fill="url(#gradUsers)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
