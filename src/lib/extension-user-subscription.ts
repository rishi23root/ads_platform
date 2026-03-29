/** Extension-reported plan: time-limited trial vs paid (orthogonal to end_date). */
export type ExtensionPlanValue = 'trial' | 'paid';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Calendar days for anonymous / provisioned trial window (`DEFAULT_TRIAL_DAYS`, default 7). */
export function defaultTrialDays(): number {
  return parsePositiveInt(process.env.DEFAULT_TRIAL_DAYS, 7);
}

/**
 * Calendar days for admin-created **paid** users when no explicit `end_date` is given
 * (`DEFAULT_PAID_SUBSCRIPTION_DAYS`, default 365).
 */
export function defaultPaidSubscriptionDays(): number {
  return parsePositiveInt(process.env.DEFAULT_PAID_SUBSCRIPTION_DAYS, 365);
}

function toValidDate(value: Date | string | number): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** End of trial window from now (local date arithmetic). */
export function computeTrialEndDateFromNow(now: Date = new Date()): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + defaultTrialDays());
  return end;
}

/** End of trial window from account `start_date` (same rule as provision, anchored on start). */
export function computeTrialEndDateFromStart(startDate: Date | string | number): Date | null {
  const start = toValidDate(startDate);
  if (start == null) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + defaultTrialDays());
  return end;
}

/** Access end for a new paid subscription from `startDate` (same calendar-day arithmetic as trial). */
export function computePaidSubscriptionEndFromStart(startDate: Date | string | number): Date | null {
  const start = toValidDate(startDate);
  if (start == null) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + defaultPaidSubscriptionDays());
  return end;
}

/** Access end for a new paid subscription from now (e.g. admin create when DB `start_date` defaults to now). */
export function computePaidSubscriptionEndFromNow(now: Date = new Date()): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + defaultPaidSubscriptionDays());
  return end;
}

/**
 * Whole days until access end (ceil). Null if open-ended (e.g. paid with no end_date).
 * Trial users without `end_date` infer end as `start_date + DEFAULT_TRIAL_DAYS` (matches dashboard-created email users).
 * If end is in the past, returns 0.
 */
export function computeExtensionDaysLeft(params: {
  endDate: Date | string | null | undefined;
  plan?: ExtensionPlanValue;
  startDate?: Date | string | null | undefined;
  now?: Date;
}): number | null {
  let end: Date | null =
    params.endDate != null ? toValidDate(params.endDate) : null;

  if (end == null && params.plan === 'trial' && params.startDate != null) {
    end = computeTrialEndDateFromStart(params.startDate);
  }

  if (end == null) return null;

  const now = params.now ?? new Date();
  const msPerDay = 86_400_000;
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / msPerDay));
}

/** Formats days-left cell; open-ended access (no computable end) shows em dash. */
export function formatExtensionDaysLeftCell(daysLeft: number | null): string {
  if (daysLeft === null) return '—';
  return String(daysLeft);
}
