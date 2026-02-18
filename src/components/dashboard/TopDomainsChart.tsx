'use client';

import { Cell, Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

interface TopDomainsChartProps {
  data: { domain: string; count: number }[];
}

export function TopDomainsChart({ data }: TopDomainsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No data yet
      </div>
    );
  }

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.domain, { label: d.domain, color: CHART_COLORS[i % CHART_COLORS.length] }])
  );

  const chartData = data.map((d) => ({ name: d.domain, value: d.count }));

  return (
    <ChartContainer config={chartConfig} className="aspect-square min-h-[200px] max-h-[240px] w-full overflow-visible">
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={32}
          outerRadius={64}
          paddingAngle={2}
          strokeWidth={1}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
