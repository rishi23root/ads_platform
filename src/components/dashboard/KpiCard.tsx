interface KpiCardProps {
  label: string;
  value: string | number;
  change?: number | null;
  empty?: boolean;
}

export function KpiCard({ label, value, change, empty }: KpiCardProps) {
  const showChange = change !== undefined && change !== null && !empty;
  const isPositive = showChange && change > 0;
  const isNegative = showChange && change < 0;

  return (
    <div className="min-h-[88px] rounded-lg border bg-card px-4 py-3 flex flex-col justify-center">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">
          {empty ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {showChange && (
          <span
            className={`text-xs font-medium tabular-nums ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              }`}
          >
            {isPositive ? '+' : ''}
            {change.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
