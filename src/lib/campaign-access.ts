import 'server-only';

import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { SessionWithRole } from '@/lib/dal';

export type CampaignRow = typeof campaigns.$inferSelect;

/** Full row or null if missing or caller is not allowed (use 404 for both to avoid IDOR). */
export async function getAccessibleCampaignById(
  session: NonNullable<SessionWithRole>,
  campaignId: string
): Promise<CampaignRow | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!row) return null;
  if (session.role === 'admin') return row;
  if (row.createdBy === session.user.id) return row;
  return null;
}

export function formatCampaignResponse(c: CampaignRow) {
  return {
    ...c,
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
    adId: c.adId ?? null,
    notificationId: c.notificationId ?? null,
    redirectId: c.redirectId ?? null,
    targetListId: c.targetListId ?? null,
  };
}
