import { database as db } from '@/db';
import {
  platforms,
  ads,
  notifications,
  redirects,
  campaigns,
  targetLists as targetListsTable,
  type Campaign,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { CampaignFormInitial, CampaignFormOptionLists } from './campaign-form-types';
import { getAllContentLinkedCampaignCounts } from '@/lib/campaign-linked-counts';

export type { CampaignFormInitial, CampaignFormOptionLists };

export async function getCampaignFormOptionLists(): Promise<CampaignFormOptionLists> {
  const [platformsList, adsRows, notificationsRows, redirectsRows, targetListsRows, counts] = await Promise.all([
    db.select({ id: platforms.id, name: platforms.name, domain: platforms.domain }).from(platforms).orderBy(platforms.name),
    db
      .select({
        id: ads.id,
        name: ads.name,
        imageUrl: ads.imageUrl,
        description: ads.description,
        targetUrl: ads.targetUrl,
      })
      .from(ads)
      .orderBy(ads.name),
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        ctaLink: notifications.ctaLink,
      })
      .from(notifications)
      .orderBy(notifications.title),
    db
      .select({
        id: redirects.id,
        name: redirects.name,
        sourceDomain: redirects.sourceDomain,
        destinationUrl: redirects.destinationUrl,
      })
      .from(redirects)
      .orderBy(redirects.name),
    db
      .select({ id: targetListsTable.id, name: targetListsTable.name })
      .from(targetListsTable)
      .orderBy(targetListsTable.name),
    getAllContentLinkedCampaignCounts(),
  ]);
  const { byAdId, byNotificationId, byRedirectId } = counts;
  const adsList = adsRows.map((a) => ({
    ...a,
    linkedCampaignCount: byAdId.get(a.id) ?? 0,
  }));
  const notificationsList = notificationsRows.map((n) => ({
    ...n,
    linkedCampaignCount: byNotificationId.get(n.id) ?? 0,
  }));
  const redirectsList = redirectsRows.map((r) => ({
    ...r,
    linkedCampaignCount: byRedirectId.get(r.id) ?? 0,
  }));
  return {
    platforms: platformsList,
    adsList,
    notificationsList,
    redirectsList,
    targetLists: targetListsRows,
  };
}

export function campaignRowToFormInitial(c: Campaign): CampaignFormInitial {
  return {
    id: c.id,
    name: c.name,
    targetAudience: c.targetAudience,
    campaignType: c.campaignType,
    frequencyType: c.frequencyType,
    frequencyCount: c.frequencyCount,
    timeStart: c.timeStart,
    timeEnd: c.timeEnd,
    status: c.status,
    startDate: c.startDate ? c.startDate.toISOString() : null,
    endDate: c.endDate ? c.endDate.toISOString() : null,
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
    adId: c.adId ?? null,
    notificationId: c.notificationId ?? null,
    redirectId: c.redirectId ?? null,
    targetListId: c.targetListId ?? null,
  };
}

export async function getCampaignByIdOrUndefined(id: string): Promise<Campaign | undefined> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row;
}
