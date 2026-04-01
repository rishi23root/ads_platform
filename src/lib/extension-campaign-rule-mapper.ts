import 'server-only';

import type { CampaignSelectRow } from '@/lib/extension-live-init';
import type { ExtensionCampaignRuleFields } from '@/lib/extension-ad-block-qualify';
import { formatExtensionCampaignScalar } from '@/lib/extension-campaign-scalars';

export function campaignSelectRowToRuleFields(c: CampaignSelectRow): ExtensionCampaignRuleFields {
  return {
    id: c.id,
    targetAudience: c.targetAudience,
    frequencyType: c.frequencyType,
    frequencyCount: c.frequencyCount,
    timeStart: formatExtensionCampaignScalar(c.timeStart),
    timeEnd: formatExtensionCampaignScalar(c.timeEnd),
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    countryCodes: c.countryCodes,
  };
}
