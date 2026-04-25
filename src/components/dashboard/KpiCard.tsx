interface KpiCardProps {
  label: string;
  value: string | number;
  change?: number | null;
  /** Shown on hover for the % (e.g. what is being compared to last month). */
  changeHint?: string;
  empty?: boolean;
}

export function KpiCard({ label, value, change, changeHint, empty }: KpiCardProps) {
  const showChange = change !== undefined && change !== null && !empty;
  const isPositive = showChange && change > 0;
  const isNegative = showChange && change < 0;

  return (
    <div className="min-h-[88px] rounded-xl border border-border bg-card/40 px-3 py-3 sm:px-4 sm:py-4 flex flex-col justify-center shadow-none">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">
          {empty ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {showChange && (
          <span
            title={changeHint}
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
