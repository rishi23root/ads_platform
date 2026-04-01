import type { Campaign } from '@/db/schema';

const SHORT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

export function campaignAudienceLabel(audience: string): string {
  if (audience === 'new_users') return 'New users (within 7 days)';
  return 'All users';
}

/** Use from campaign form local state (strings from inputs). */
export function campaignFrequencyFromFormState(
  frequencyType: string,
  frequencyCountStr: string,
  timeStart: string,
  timeEnd: string
): string {
  const n = frequencyCountStr.trim() ? parseInt(frequencyCountStr, 10) : null;
  return campaignFrequencyLabel({
    frequencyType: frequencyType as Campaign['frequencyType'],
    frequencyCount: Number.isFinite(n) ? n : null,
    timeStart: timeStart.trim() || null,
    timeEnd: timeEnd.trim() || null,
  });
}

export function campaignFrequencyLabel(c: Pick<
  Campaign,
  'frequencyType' | 'frequencyCount' | 'timeStart' | 'timeEnd'
>): string {
  switch (c.frequencyType) {
    case 'always':
      return 'Always';
    case 'full_day':
      return 'Full day';
    case 'only_once':
      return 'Once per visitor';
    case 'specific_count': {
      const n = c.frequencyCount;
      return typeof n === 'number' && n > 0
        ? `Up to ${n} time${n === 1 ? '' : 's'} per visitor`
        : 'Specific count (set max views)';
    }
    case 'time_based': {
      const a = c.timeStart?.trim() || '—';
      const b = c.timeEnd?.trim() || '—';
      return `Between ${a} and ${b}`;
    }
    default:
      return String(c.frequencyType).replace(/_/g, ' ');
  }
}

function parseTs(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Schedule window for detail cards (full datetime). */
export function campaignScheduleWindowLabel(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  const s = parseTs(startDate);
  const e = parseTs(endDate);
  if (!s && !e) return 'No fixed window';
  const left = s ? s.toLocaleString(undefined, SHORT_DATE_OPTS) : '—';
  const right = e ? e.toLocaleString(undefined, SHORT_DATE_OPTS) : 'Open-ended';
  return `${left} – ${right}`;
}

/** Compact schedule for list table rows. */
export function campaignScheduleBrief(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  const s = parseTs(startDate);
  const e = parseTs(endDate);
  if (!s && !e) return 'Always on';
  if (s && e) {
    return `${s.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (e && !s) return `Ends ${e.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `From ${s!.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function campaignStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'active':
      return 'default';
    case 'inactive':
      return 'secondary';
    case 'scheduled':
      return 'outline';
    case 'expired':
      return 'destructive';
    case 'deleted':
      return 'destructive';
    default:
      return 'secondary';
  }
}
