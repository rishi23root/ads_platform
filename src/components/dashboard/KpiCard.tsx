import Link from 'next/link';

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: number | null;
  /** Shown on hover for the % (e.g. what is being compared to last month). */
  changeHint?: string;
  empty?: boolean;
  /** Optional footer link (e.g. jump to detailed table). */
  footerLink?: { href: string; label: string };
}

export function KpiCard({
  label,
  value,
  change,
  changeHint,
  empty,
  footerLink,
}: KpiCardProps) {
  const showChange = change !== undefined && change !== null && !empty;
  const isPositive = showChange && change > 0;
  const isNegative = showChange && change < 0;

  return (
    <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-border bg-card/40 px-3 py-3 shadow-none sm:px-4 sm:py-4">
      <div className="flex flex-col justify-center space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
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
      {footerLink ? (
        <div className="mt-3 border-t border-border/60 pt-2.5">
          <Link
            href={footerLink.href}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {footerLink.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
