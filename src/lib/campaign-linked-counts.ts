import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { and, arrayContains, count, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { campaignRowNotSoftDeleted } from '@/lib/campaign-soft-delete-sql';
import { publishCampaignUpdated } from '@/lib/redis';

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

/** Load all three aggregates in a single GROUPING SETS query — one table scan instead of three. */
export async function getAllContentLinkedCampaignCounts(): Promise<{
  byAdId: Map<string, number>;
  byNotificationId: Map<string, number>;
  byRedirectId: Map<string, number>;
}> {
  const rows = await db.execute<{
    ad_id: string | null;
    notification_id: string | null;
    redirect_id: string | null;
    linked_count: number;
  }>(sql`
    SELECT
      ${campaigns.adId}::text          AS ad_id,
      ${campaigns.notificationId}::text AS notification_id,
      ${campaigns.redirectId}::text     AS redirect_id,
      count(*)::int                     AS linked_count
    FROM ${campaigns}
    WHERE ${campaigns.status}::text <> 'deleted'
    GROUP BY GROUPING SETS (
      (${campaigns.adId}),
      (${campaigns.notificationId}),
      (${campaigns.redirectId})
    )
    HAVING
      ${campaigns.adId} IS NOT NULL
      OR ${campaigns.notificationId} IS NOT NULL
      OR ${campaigns.redirectId} IS NOT NULL
  `);

  const byAdId = new Map<string, number>();
  const byNotificationId = new Map<string, number>();
  const byRedirectId = new Map<string, number>();

  for (const row of rows) {
    const cnt = Number(row.linked_count);
    if (row.ad_id) byAdId.set(row.ad_id, cnt);
    else if (row.notification_id) byNotificationId.set(row.notification_id, cnt);
    else if (row.redirect_id) byRedirectId.set(row.redirect_id, cnt);
  }

  return { byAdId, byNotificationId, byRedirectId };
}

export async function getLinkedCampaignCountForAdId(adId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(campaigns)
    .where(and(eq(campaigns.adId, adId), campaignRowNotSoftDeleted));
  return Number(row?.c ?? 0);
}

export async function getLinkedCampaignCountForNotificationId(
  notificationId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(campaigns)
    .where(and(eq(campaigns.notificationId, notificationId), campaignRowNotSoftDeleted));
  return Number(row?.c ?? 0);
}

export async function getLinkedCampaignCountForRedirectId(redirectId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(campaigns)
    .where(and(eq(campaigns.redirectId, redirectId), campaignRowNotSoftDeleted));
  return Number(row?.c ?? 0);
}

export async function getLinkedCampaignCountForPlatformId(platformId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(campaigns)
    .where(and(arrayContains(campaigns.platformIds, [platformId]), campaignRowNotSoftDeleted));
  return Number(row?.c ?? 0);
}

/**
 * Find a campaign linked to the given redirect and publish `campaign_updated`
 * so every SSE-connected extension rebuilds its cached state.
 *
 * The SSE `campaign_updated` handler always rebuilds the full payload,
 * so a single publish covers all affected campaigns.
 */
export async function publishCampaignUpdatedForLinkedRedirect(
  redirectId: string
): Promise<void> {
  const rows = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.redirectId, redirectId), campaignRowNotSoftDeleted))
    .limit(1);

  if (rows.length > 0) {
    await publishCampaignUpdated(rows[0].id);
  }
}
