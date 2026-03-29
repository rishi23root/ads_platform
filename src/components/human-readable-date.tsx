'use client';

import { format, formatRelative, isToday, isTomorrow, isYesterday } from 'date-fns';

import { cn } from '@/lib/utils';

type HumanReadableDateProps = {
  date: Date;
  className?: string;
  /**
   * `relative` — “today at 2:45 PM”, “yesterday at …”, plus `formatRelative` phrasing when close;
   * far dates use a short month name instead of numeric `MM/dd/yyyy` fallback from date-fns alone.
   * `medium` — locale medium date + short time (dense grids).
   */
  mode?: 'relative' | 'medium';
  /** Split day phrase and time on two lines (compact cells / tables). */
  dense?: boolean;
};

function splitDayAndTime(label: string): { day: string; time?: string } {
  const at = ' at ';
  const i = label.lastIndexOf(at);
  if (i === -1) return { day: label };
  return { day: label.slice(0, i), time: label.slice(i + at.length) };
}

/** e.g. "Mar 29, 2026, 2:45 PM" → date part vs time (last comma). */
function splitLocaleMediumDateTime(label: string): { day: string; time?: string } {
  const i = label.lastIndexOf(', ');
  if (i === -1) return { day: label };
  return { day: label.slice(0, i), time: label.slice(i + 2) };
}

function relativeConversationLabel(date: Date, base: Date): string {
  const time = format(date, 'p');

  if (isToday(date)) return `today at ${time}`;
  if (isYesterday(date)) return `yesterday at ${time}`;
  if (isTomorrow(date)) return `tomorrow at ${time}`;

  const raw = formatRelative(date, base).trim();
  // date-fns en-US (and similar) uses `P` for distant same-calendar-year dates → "04/05/2026"
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    return `${format(date, 'MMM d, yyyy')} at ${time}`;
  }

  return raw;
}

function denseLines(
  mode: 'relative' | 'medium',
  label: string
): { day: string; time?: string } {
  if (mode === 'medium') {
    return splitLocaleMediumDateTime(label);
  }
  return splitDayAndTime(label);
}

/**
 * `suppressHydrationWarning`: comparison time differs between server and client for `relative` mode.
 */
export function HumanReadableDate({
  date,
  className,
  mode = 'relative',
  dense = false,
}: HumanReadableDateProps) {
  if (Number.isNaN(date.getTime())) {
    return (
      <span className={className} suppressHydrationWarning>
        —
      </span>
    );
  }

  const title = date.toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const label =
    mode === 'medium'
      ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : relativeConversationLabel(date, new Date());

  if (dense) {
    const { day: dayLine, time: timeLine } = denseLines(mode, label);
    return (
      <span
        className={cn(
          'inline-flex max-w-full flex-col items-start gap-0 leading-snug [text-wrap:balance]',
          className
        )}
        title={title}
        suppressHydrationWarning
      >
        <span className="text-foreground text-[0.8125rem] font-medium leading-tight">{dayLine}</span>
        {timeLine ? (
          <span className="text-muted-foreground text-xs leading-tight tabular-nums">{timeLine}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={className} title={title} suppressHydrationWarning>
      {label}
    </span>
  );
}
