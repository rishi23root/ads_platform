import type { ChartConfig } from '@/components/ui/chart';

/**
 * Draw order: largest series first (drawn behind), smallest last (drawn on top).
 * Each area starts from 0 (non-stacked) so the Y-axis reflects actual per-type counts.
 */
export const EXTENSION_EVENT_SERIES_KEYS = [
  'visit',
  'popup',
  'notification',
  'ad',
  'redirect',
] as const;

export type ExtensionEventSeriesKey = (typeof EXTENSION_EVENT_SERIES_KEYS)[number];

export type ExtensionEventChartRow = Record<ExtensionEventSeriesKey, number> & {
  date: string;
};

export const extensionEventsChartConfig = {
  visit: {
    label: 'Visit',
    theme: {
      light: 'oklch(0.52 0.06 265)',
      dark: 'oklch(0.78 0.07 265)',
    },
  },
  notification: {
    label: 'Notification',
    theme: {
      light: 'oklch(0.5 0.22 303)',
      dark: 'oklch(0.74 0.2 303)',
    },
  },
  ad: {
    label: 'Ad',
    theme: {
      light: 'oklch(0.48 0.14 210)',
      dark: 'oklch(0.76 0.14 210)',
    },
  },
  popup: {
    label: 'Popup',
    theme: {
      light: 'oklch(0.55 0.17 55)',
      dark: 'oklch(0.82 0.16 55)',
    },
  },
  redirect: {
    label: 'Redirect',
    theme: {
      light: 'oklch(0.48 0.14 155)',
      dark: 'oklch(0.74 0.14 155)',
    },
  },
} satisfies ChartConfig;

export function resolveExtensionEventColor(
  key: ExtensionEventSeriesKey,
  resolvedTheme: string | undefined,
  config: ChartConfig = extensionEventsChartConfig
): string {
  const entry = config[key];
  if (!entry) return 'var(--muted-foreground)';
  if ('theme' in entry && entry.theme) {
    return resolvedTheme === 'dark' ? entry.theme.dark : entry.theme.light;
  }
  if ('color' in entry && entry.color) return entry.color;
  return 'var(--muted-foreground)';
}

export type ExtensionEventSegment = { key: ExtensionEventSeriesKey; name: string; value: number };

/**
 * Pie segments for a single day. Returned in **descending count** for the pie
 * (largest slice first). Use `extensionEventLegendSegments` for the tooltip
 * legend which keeps area-chart stack order instead.
 */
export function extensionEventPieSegments(
  row: ExtensionEventChartRow,
  config: ChartConfig = extensionEventsChartConfig
): ExtensionEventSegment[] {
  return EXTENSION_EVENT_SERIES_KEYS.map((key) => ({
    key,
    name: String(config[key]?.label ?? key),
    value: Number(row[key]) || 0,
  }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Segments sorted by descending count (highest at top) for the tooltip legend. */
export function extensionEventLegendSegments(
  row: ExtensionEventChartRow,
  config: ChartConfig = extensionEventsChartConfig
): ExtensionEventSegment[] {
  return EXTENSION_EVENT_SERIES_KEYS.map((key) => ({
    key,
    name: String(config[key]?.label ?? key),
    value: Number(row[key]) || 0,
  }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function extensionEventRowTotal(row: ExtensionEventChartRow): number {
  return EXTENSION_EVENT_SERIES_KEYS.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
}

export function extensionEventChartAllZeros(rows: ExtensionEventChartRow[]): boolean {
  if (rows.length === 0) return false;
  return rows.every((d) => extensionEventRowTotal(d) === 0);
}

/** Y-axis tick labels for extension event charts (compact k/M for large values). */
export function formatExtensionChartYAxisTick(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/**
 * Integer Y ticks that hug the data (~3% headroom, ≤5 steps).
 * Uses 1/2/5-style steps so ticks stay legible with Recharts (see YAxis interval).
 */
export function niceExtensionChartYAxisTicks(max: number): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const ceil = Math.ceil(max * 1.03);
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
  let step = 1;
  for (const c of candidates) {
    if (Math.ceil(ceil / c) <= 5) {
      step = c;
      break;
    }
  }
  if (step === 1 && ceil > 50000) step = Math.ceil(ceil / 5 / 1000) * 1000;
  const top = Math.ceil(ceil / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

export function formatExtensionChartTooltipDate(label: unknown, fallbackIsoDate: string): string {
  if (label == null) return fallbackIsoDate;
  const d = new Date(String(label));
  if (Number.isNaN(d.getTime())) return String(label);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
