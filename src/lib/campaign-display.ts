import type { Campaign } from '@/db/schema';

/** Stable across SSR and client (avoids hydration mismatch from differing locales). */
const STABLE_LOCALE = 'en-US';

const SHORT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const BRIEF_DAY_MONTH_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
};

export function campaignAudienceLabel(audience: string): string {
  if (audience === 'new_users') return 'New users (within 7 days)';
  return 'All users';
}

/** DB/API time-of-day is often `HH:mm:ss`; show `HH:mm` in UI. */
function timeOfDayDisplay(value: string): string {
  const t = value.trim();
  if (!t) return t;
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  const hh = Math.min(23, Math.max(0, h));
  const mm = Math.min(59, Math.max(0, m));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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
      // Legacy DB value; same delivery rules as always — show unified label
      return 'Always';
    case 'only_once':
      // Legacy; same cap as specific_count 1
      return 'Up to 1 time per visitor';
    case 'specific_count': {
      const n = c.frequencyCount;
      return typeof n === 'number' && n > 0
        ? `Up to ${n} time${n === 1 ? '' : 's'} per visitor`
        : 'Specific count (set max views)';
    }
    case 'time_based': {
      const rawA = c.timeStart?.trim() ?? '';
      const rawB = c.timeEnd?.trim() ?? '';
      const a = rawA ? timeOfDayDisplay(rawA) : '—';
      const b = rawB ? timeOfDayDisplay(rawB) : '—';
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
  const left = s ? s.toLocaleString(STABLE_LOCALE, SHORT_DATE_OPTS) : '—';
  const right = e ? e.toLocaleString(STABLE_LOCALE, SHORT_DATE_OPTS) : 'Open-ended';
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
    return `${s.toLocaleDateString(STABLE_LOCALE, BRIEF_DAY_MONTH_OPTS)} – ${e.toLocaleDateString(STABLE_LOCALE, SHORT_DATE_OPTS)}`;
  }
  if (e && !s) return `Ends ${e.toLocaleDateString(STABLE_LOCALE, SHORT_DATE_OPTS)}`;
  return `From ${s!.toLocaleDateString(STABLE_LOCALE, SHORT_DATE_OPTS)}`;
}

/**
 * True when today's calendar date (UTC) is after the end date's calendar day (UTC).
 * Matches {@link campaignScheduleBrief} / list tables (UTC). Open-ended (null end) is never past.
 */
export function isCampaignScheduleEndPastUtc(
  endDate: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  const e = parseTs(endDate);
  if (!e) return false;
  const endY = e.getUTCFullYear();
  const endM = e.getUTCMonth();
  const endD = e.getUTCDate();
  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth();
  const nowD = now.getUTCDate();
  if (nowY !== endY) return nowY > endY;
  if (nowM !== endM) return nowM > endM;
  return nowD > endD;
}

/** Active campaign whose schedule end (UTC calendar day) is before today — highlight in tables. */
export function isCampaignActiveButScheduleEnded(
  status: string,
  endDate: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  return status === 'active' && isCampaignScheduleEndPastUtc(endDate, now);
}

/** Soft rose-red so expired-but-active schedules read as a light warning, not destructive. */
const SCHEDULE_ACTIVE_PAST_END_TEXT_CLASS =
  'text-rose-500/75 dark:text-rose-400/80';

/** Text color for schedule cells: soft red when active but past end, else muted. */
export function campaignScheduleTableTextColorClass(
  status: string,
  endDate: Date | string | null | undefined,
  now: Date = new Date()
): string {
  return isCampaignActiveButScheduleEnded(status, endDate, now)
    ? SCHEDULE_ACTIVE_PAST_END_TEXT_CLASS
    : 'text-muted-foreground';
}

/** Human label for list/detail when showing raw `frequency_type` (legacy full_day / only_once). */
export function campaignFrequencyTypeDisplayName(frequencyType: string): string {
  if (frequencyType === 'full_day') return 'always';
  if (frequencyType === 'only_once') return 'specific count';
  return frequencyType.replace(/_/g, ' ');
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
