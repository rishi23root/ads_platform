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
      <div className="flex h-full min-h-[200px] flex-1 flex-col items-center justify-center gap-3 px-2 py-4 text-center sm:px-4">
        <p className="text-sm font-medium text-foreground">No domain data in this range</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Once this campaign starts getting impressions, the breakdown by site appears here for
          the same time range as Activity.
        </p>
      </div>
    );
  }

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.domain, { label: d.domain, color: CHART_COLORS[i % CHART_COLORS.length] }])
  );

  const chartData = data.map((d) => ({ name: d.domain, value: d.count }));

  return (
    <ChartContainer
      config={chartConfig}
      className="flex h-full min-h-[280px] w-full flex-1 overflow-visible [&_.recharts-responsive-container]:!h-full [&_.recharts-responsive-container]:min-h-[280px] [&_.recharts-surface]:overflow-visible"
    >
      <PieChart margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <ChartLegend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          wrapperStyle={{ width: '36%', paddingLeft: 4, fontSize: 12 }}
          content={
            <ChartLegendContent
              verticalAlign="middle"
              className="h-full !pt-0 !pb-0 flex-col items-start justify-center gap-2 pl-1 text-left"
            />
          }
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="44%"
          cy="50%"
          innerRadius="42%"
          outerRadius="92%"
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
