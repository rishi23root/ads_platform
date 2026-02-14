'use client';

import { ActivityChart } from './ActivityChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ActivitySectionProps {
  chartData: { date: string; impressions: number; users: number }[];
  range: string;
  onRangeChange: (range: string) => void;
  loading?: boolean;
  showTitle?: boolean;
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
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {showTitle && <h2 className="text-sm font-medium">Activity</h2>}
        {rangeSelect}
      </div>
      <ActivityChart data={chartData} loading={loading} error={null} />
    </section>
  );
}
