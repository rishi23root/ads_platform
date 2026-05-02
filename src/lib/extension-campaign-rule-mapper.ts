import 'server-only';

import type { CampaignSelectRow } from '@/lib/extension-live-init';
import type { ExtensionCampaignRuleFields } from '@/lib/extension-campaign-qualify';
import { formatExtensionCampaignScalar } from '@/lib/extension-campaign-scalars';

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function campaignSelectRowToRuleFields(c: CampaignSelectRow): ExtensionCampaignRuleFields {
  return {
    id: c.id,
    targetAudience: c.targetAudience,
    frequencyType: c.frequencyType,
    frequencyCount: c.frequencyCount,
    timeStart: formatExtensionCampaignScalar(c.timeStart),
    timeEnd: formatExtensionCampaignScalar(c.timeEnd),
    status: c.status,
    startDate: toDateOrNull(c.startDate),
    endDate: toDateOrNull(c.endDate),
    countryCodes: c.countryCodes,
    targetListId: c.targetListId ?? null,
  };
}
