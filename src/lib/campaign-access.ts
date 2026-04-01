import 'server-only';

import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { SessionWithRole } from '@/lib/dal';

export type CampaignRow = typeof campaigns.$inferSelect;

/** Full row or null if missing or caller is not allowed (use 404 for both to avoid IDOR). */
export async function getAccessibleCampaignById(
  _session: NonNullable<SessionWithRole>,
  campaignId: string
): Promise<CampaignRow | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  return row ?? null;
}

export function formatCampaignResponse(c: CampaignRow) {
  return {
    ...c,
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
    adId: c.adId ?? null,
    notificationId: c.notificationId ?? null,
    redirectId: c.redirectId ?? null,
  };
}
