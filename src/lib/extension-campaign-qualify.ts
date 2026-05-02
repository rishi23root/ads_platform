/**
 * Campaign qualification rules applied by the extension serve and SSE live flows.
 *
 * Filters applied IN ORDER (all must pass for a campaign to qualify):
 * 1. Schedule: status === 'active', now within startDate/endDate if set
 * 2. Audience: targetAudience === 'new_users' → end-user must be "new" (see isExtensionUserNew)
 * 3. Time-of-day (frequencyType === 'time_based'): local server time must fall in timeStart/timeEnd window
 *    (supports overnight windows when timeStart > timeEnd)
 * 4. Frequency caps (only for frequencyType === 'only_once' | 'specific_count'):
 *    - only_once: exclude if user already has ≥1 enduser_events row for this campaignId
 *    - specific_count: exclude if count ≥ frequencyCount (counts ALL event types for that campaignId)
 * 5. Geo: if campaign.countryCodes non-empty, request must supply matching ISO2 (empty array = worldwide)
 *
 * NOT gated in this list (always pass step 4): frequencyType 'full_day', 'always' (no cap from this loop).
 *
 * Separate from this module: platform/domain membership, campaign type vs ads vs notifications (resolved before qualification).
 */

export type ExtensionCampaignRuleFields = {
  id: string;
  targetAudience: string;
  frequencyType: string;
  frequencyCount: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  countryCodes: string[] | null;
  targetListId: string | null;
};

export type ExtensionCampaignQualifyContext = {
  now: Date;
  /** Minutes since midnight in range 0–1440 (hours*60 + minutes). */
  currentMinutes: number;
  isNewUser: boolean;
  /** Uppercase ISO2 from request geo headers, or null */
  endUserGeoCountry: string | null;
  /** Prior event counts per campaignId (all types with that campaign_id) */
  viewCountByCampaignId: Map<string, number>;
  /** Target list IDs the current end-user belongs to (pre-computed). */
  targetListMembership: Set<string>;
};

/** "New" = first enduser event OR end_users.startDate is within `withinDays` days of now. */
export function isExtensionUserNew(firstEventOrAccountStart: Date, withinDays = 7): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  return new Date(firstEventOrAccountStart) >= cutoff;
}

export function isCampaignScheduleActive(
  status: string,
  startDate: Date | null,
  endDate: Date | null,
  now: Date
): boolean {
  if (status !== 'active') return false;
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
}

export function currentLocalMinutesSinceMidnight(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function parseCampaignTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.length >= 2) return parts[0] * 60 + parts[1];
  return null;
}

function passesTimeBasedWindow(
  frequencyType: string,
  timeStart: string | null,
  timeEnd: string | null,
  currentMinutes: number
): boolean {
  if (frequencyType !== 'time_based') return true;
  const start = parseCampaignTimeToMinutes(timeStart);
  const end = parseCampaignTimeToMinutes(timeEnd);
  if (start === null || end === null) return true;
  if (start <= end) {
    if (currentMinutes < start || currentMinutes > end) return false;
  } else {
    if (currentMinutes > end && currentMinutes < start) return false;
  }
  return true;
}

function passesFrequencyCap(
  c: ExtensionCampaignRuleFields,
  viewCount: number
): boolean {
  if (c.frequencyType === 'only_once') {
    if (viewCount >= 1) return false;
  }
  if (c.frequencyType === 'specific_count') {
    if (c.frequencyCount !== null && viewCount >= c.frequencyCount) return false;
  }
  return true;
}

function passesCountryTarget(
  countryCodes: string[] | null | undefined,
  endUserGeoCountry: string | null
): boolean {
  const codes = countryCodes ?? [];
  if (codes.length === 0) return true;
  if (!endUserGeoCountry) return false;
  const set = new Set(codes.map((code) => String(code).toUpperCase()));
  return set.has(endUserGeoCountry);
}

/** Returns campaigns that pass all serving filters. */
export function filterQualifyingExtensionCampaigns<T extends ExtensionCampaignRuleFields>(
  campaigns: T[],
  ctx: ExtensionCampaignQualifyContext
): T[] {
  const out: T[] = [];
  for (const c of campaigns) {
    if (!isCampaignScheduleActive(c.status, c.startDate, c.endDate, ctx.now)) continue;
    if (c.targetAudience === 'new_users' && !ctx.isNewUser) continue;
    if (!passesTimeBasedWindow(c.frequencyType, c.timeStart, c.timeEnd, ctx.currentMinutes)) continue;

    if (c.frequencyType === 'only_once' || c.frequencyType === 'specific_count') {
      const viewCount = ctx.viewCountByCampaignId.get(c.id) ?? 0;
      if (!passesFrequencyCap(c, viewCount)) continue;
    }

    if (!passesCountryTarget(c.countryCodes, ctx.endUserGeoCountry)) continue;

    if (c.targetListId && !ctx.targetListMembership.has(c.targetListId)) continue;

    out.push(c);
  }
  return out;
}
