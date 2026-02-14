import { KpiCard } from './KpiCard';

interface KpiGridProps {
  impressions: number;
  uniqueUsers: number;
  impressionsChange?: number | null;
  usersChange?: number | null;
}

export function KpiGrid({
  impressions,
  uniqueUsers,
  impressionsChange,
  usersChange,
}: KpiGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 w-full max-w-2xl">
      <KpiCard label="Impressions" value={impressions} change={impressionsChange} />
      <KpiCard label="Unique Users" value={uniqueUsers} change={usersChange} />
    </div>
  );
}
