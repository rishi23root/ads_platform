'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartDataPoint {
  date: string;
  served: number;
}

const chartConfig = {
  served: {
    label: 'Served',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

const rangeLabels: Record<string, string> = {
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '30d': 'Last 30 days',
};

interface CampaignChartProps {
  campaignId: string;
}

export function CampaignChart({ campaignId }: CampaignChartProps) {
  const [timeRange, setTimeRange] = React.useState('14d');
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${campaignId}/analytics?range=${timeRange}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch chart data');
        return res.json();
      })
      .then((data: ChartDataPoint[]) => {
        if (!cancelled) {
          setChartData(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart data');
          setChartData([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, timeRange]);

  const descriptionText = rangeLabels[timeRange] ?? 'Last 14 days';

  return (
    <Card className="py-4 px-4 gap-2">
      <CardHeader className="p-0">
        <CardTitle className="text-sm font-medium">Activity</CardTitle>
        <CardDescription className="text-xs">{descriptionText}</CardDescription>
        <CardAction>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger size="sm" className="w-36" aria-label="Select time range">
              <SelectValue placeholder="Last 14 days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0 pt-3">
        {loading ? (
          <Skeleton className="h-[160px] w-full rounded-lg" />
        ) : error ? (
          <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No activity for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[160px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillServed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-served)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-served)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="served"
                type="natural"
                fill="url(#fillServed)"
                stroke="var(--color-served)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
