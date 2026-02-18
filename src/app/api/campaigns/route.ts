import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  campaigns,
  campaignPlatforms,
  campaignCountries,
  campaignAd,
  campaignNotification,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';

export const dynamic = 'force-dynamic';

// GET list campaigns (user: own/read-only, admin: all)
export async function GET() {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const list = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        targetAudience: campaigns.targetAudience,
        campaignType: campaigns.campaignType,
        frequencyType: campaigns.frequencyType,
        frequencyCount: campaigns.frequencyCount,
        timeStart: campaigns.timeStart,
        timeEnd: campaigns.timeEnd,
        createdBy: campaigns.createdBy,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .orderBy(campaigns.createdAt);

    // Enrich with platform ids, ad ids, notification id
    const result = await Promise.all(
      list.map(async (c) => {
        const [platformRows, countryRows, adRow, notifRow] = await Promise.all([
          db.select({ platformId: campaignPlatforms.platformId }).from(campaignPlatforms).where(eq(campaignPlatforms.campaignId, c.id)),
          db.select({ countryCode: campaignCountries.countryCode }).from(campaignCountries).where(eq(campaignCountries.campaignId, c.id)),
          db.select({ adId: campaignAd.adId }).from(campaignAd).where(eq(campaignAd.campaignId, c.id)).limit(1),
          db.select({ notificationId: campaignNotification.notificationId }).from(campaignNotification).where(eq(campaignNotification.campaignId, c.id)).limit(1),
        ]);
        return {
          ...c,
          platformIds: platformRows.map((r) => r.platformId),
          countryCodes: countryRows.map((r) => r.countryCode),
          adId: adRow[0]?.adId ?? null,
          notificationId: notifRow[0]?.notificationId ?? null,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// POST create campaign (admin only)
export async function POST(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      targetAudience,
      campaignType,
      frequencyType,
      frequencyCount,
      timeStart,
      timeEnd,
      status,
      startDate,
      endDate,
      platformIds,
      countryCodes,
      adId,
      notificationId,
    } = body;

    if (!name || !campaignType || !frequencyType) {
      return NextResponse.json(
        { error: 'name, campaignType, and frequencyType are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(platformIds) || platformIds.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one domain (platform)' },
        { status: 400 }
      );
    }

    if ((campaignType === 'ads' || campaignType === 'popup') && !adId) {
      return NextResponse.json(
        { error: `Select an ${campaignType === 'popup' ? 'pop up' : 'ad'}` },
        { status: 400 }
      );
    }
    if (campaignType === 'notification' && !notificationId) {
      return NextResponse.json(
        { error: 'Select a notification' },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(campaigns)
      .values({
        name,
        targetAudience: targetAudience ?? 'all_users',
        campaignType,
        frequencyType,
        frequencyCount: frequencyCount ?? null,
        timeStart: timeStart ?? null,
        timeEnd: timeEnd ?? null,
        status: status ?? 'inactive',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdBy: sessionWithRole.user.id,
      })
      .returning({ id: campaigns.id });

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    const campaignId = inserted.id;

    if (Array.isArray(platformIds) && platformIds.length > 0) {
      await db.insert(campaignPlatforms).values(
        platformIds.map((platformId: string) => ({ campaignId, platformId }))
      );
    }
    if (Array.isArray(countryCodes) && countryCodes.length > 0) {
      await db.insert(campaignCountries).values(
        countryCodes.map((code: string) => ({ campaignId, countryCode: code.toUpperCase().slice(0, 2) }))
      );
    }
    if ((campaignType === 'ads' || campaignType === 'popup') && adId) {
      await db.insert(campaignAd).values({ campaignId, adId });
    }
    if (campaignType === 'notification' && notificationId) {
      await db.insert(campaignNotification).values({ campaignId, notificationId });
    }

    return NextResponse.json({ id: campaignId });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
