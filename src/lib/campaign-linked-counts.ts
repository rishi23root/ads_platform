import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { and, count, inArray, isNotNull } from 'drizzle-orm';
import { campaignRowNotSoftDeleted } from '@/lib/campaign-soft-delete-sql';

function rowsToMap(
  rows: { id: string | null; linkedCampaignCount: number | bigint }[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.id != null) {
      map.set(row.id, Number(row.linkedCampaignCount));
    }
  }
  return map;
}

/** Campaigns referencing each ad (ads + popup types share ad_id). */
export async function getLinkedCampaignCountByAdId(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      id: campaigns.adId,
      linkedCampaignCount: count(),
    })
    .from(campaigns)
    .where(and(isNotNull(campaigns.adId), campaignRowNotSoftDeleted))
    .groupBy(campaigns.adId);
  return rowsToMap(rows);
}

export async function getLinkedCampaignCountByNotificationId(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      id: campaigns.notificationId,
      linkedCampaignCount: count(),
    })
    .from(campaigns)
    .where(and(isNotNull(campaigns.notificationId), campaignRowNotSoftDeleted))
    .groupBy(campaigns.notificationId);
  return rowsToMap(rows);
}

/** Counts only for the given notification ids (e.g. current API page); avoids scanning all distinct FKs. */
export async function getLinkedCampaignCountByNotificationIdForIds(
  notificationIds: string[]
): Promise<Map<string, number>> {
  if (notificationIds.length === 0) {
    return new Map();
  }
  const unique = [...new Set(notificationIds)];
  const rows = await db
    .select({
      id: campaigns.notificationId,
      linkedCampaignCount: count(),
    })
    .from(campaigns)
    .where(
      and(
        isNotNull(campaigns.notificationId),
        inArray(campaigns.notificationId, unique),
        campaignRowNotSoftDeleted
      )
    )
    .groupBy(campaigns.notificationId);
  return rowsToMap(rows);
}

export async function getLinkedCampaignCountByRedirectId(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      id: campaigns.redirectId,
      linkedCampaignCount: count(),
    })
    .from(campaigns)
    .where(and(isNotNull(campaigns.redirectId), campaignRowNotSoftDeleted))
    .groupBy(campaigns.redirectId);
  return rowsToMap(rows);
}

/** Load all three aggregates in parallel (e.g. campaign form option lists). */
export async function getAllContentLinkedCampaignCounts(): Promise<{
  byAdId: Map<string, number>;
  byNotificationId: Map<string, number>;
  byRedirectId: Map<string, number>;
}> {
  const [byAdId, byNotificationId, byRedirectId] = await Promise.all([
    getLinkedCampaignCountByAdId(),
    getLinkedCampaignCountByNotificationId(),
    getLinkedCampaignCountByRedirectId(),
  ]);
  return { byAdId, byNotificationId, byRedirectId };
}
