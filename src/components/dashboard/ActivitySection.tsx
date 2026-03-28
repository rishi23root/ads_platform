'use client';

import { ActivityChart } from './ActivityChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ActivitySectionProps {
  chartData: { date: string; impressions: number; users: number }[];
  range: string;
  onRangeChange: (range: string) => void;
  loading?: boolean;
  showTitle?: boolean;
  /** Extra classes for the Activity heading when showTitle is true */
  titleClassName?: string;
  showRangeOnly?: boolean;
  showChartOnly?: boolean;
}

const rangeLabels: Record<string, string> = {
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '30d': 'Last 30 days',
};

export function ActivitySection({
  chartData,
  range,
  onRangeChange,
  loading = false,
  showTitle = true,
  titleClassName,
  showRangeOnly = false,
  showChartOnly = false,
}: ActivitySectionProps) {
  const rangeSelect = (
    <Select value={range} onValueChange={onRangeChange}>
      <SelectTrigger size="sm" className="w-36" aria-label="Time range">
        <SelectValue placeholder={rangeLabels[range]} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="14d">Last 14 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
  );

  if (showRangeOnly) {
    return rangeSelect;
  }

  if (showChartOnly) {
    return <ActivityChart data={chartData} loading={loading} error={null} />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {showTitle && (
          <h2 className={cn('text-sm font-medium text-muted-foreground', titleClassName)}>Activity</h2>
        )}
        {rangeSelect}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ActivityChart data={chartData} loading={loading} error={null} fillHeight />
      </div>
    </section>
  );
}
