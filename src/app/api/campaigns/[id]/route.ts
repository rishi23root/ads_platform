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

async function getCampaignWithRelations(id: string) {
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) return null;

  const [platformRows, countryRows, adRow, notifRow] = await Promise.all([
    db.select({ platformId: campaignPlatforms.platformId }).from(campaignPlatforms).where(eq(campaignPlatforms.campaignId, id)),
    db.select({ countryCode: campaignCountries.countryCode }).from(campaignCountries).where(eq(campaignCountries.campaignId, id)),
    db.select({ adId: campaignAd.adId }).from(campaignAd).where(eq(campaignAd.campaignId, id)).limit(1),
    db.select({ notificationId: campaignNotification.notificationId }).from(campaignNotification).where(eq(campaignNotification.campaignId, id)).limit(1),
  ]);

  return {
    ...c,
    platformIds: platformRows.map((r) => r.platformId),
    countryCodes: countryRows.map((r) => r.countryCode),
    adId: adRow[0]?.adId ?? null,
    notificationId: notifRow[0]?.notificationId ?? null,
  };
}

// GET single campaign
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const campaign = await getCampaignWithRelations(id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

// PUT update campaign (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const [existing] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
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

    const effectivePlatformIds = platformIds ?? (await db.select({ platformId: campaignPlatforms.platformId }).from(campaignPlatforms).where(eq(campaignPlatforms.campaignId, id))).map((r) => r.platformId);
    if (!Array.isArray(effectivePlatformIds) || effectivePlatformIds.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one domain (platform)' },
        { status: 400 }
      );
    }

    const effectiveCampaignType = campaignType ?? existing.campaignType;
    if (effectiveCampaignType === 'ads' || effectiveCampaignType === 'popup') {
      const [adRow] = await db.select({ adId: campaignAd.adId }).from(campaignAd).where(eq(campaignAd.campaignId, id)).limit(1);
      const effectiveAdId = adId !== undefined ? adId : adRow?.adId;
      if (!effectiveAdId) {
        return NextResponse.json(
          { error: `Select an ${effectiveCampaignType === 'popup' ? 'pop up' : 'ad'}` },
          { status: 400 }
        );
      }
    } else if (effectiveCampaignType === 'notification') {
      const [notifRow] = await db.select({ notificationId: campaignNotification.notificationId }).from(campaignNotification).where(eq(campaignNotification.campaignId, id)).limit(1);
      const effectiveNotifId = notificationId !== undefined ? notificationId : notifRow?.notificationId;
      if (!effectiveNotifId) {
        return NextResponse.json(
          { error: 'Select a notification' },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    await db
      .update(campaigns)
      .set({
        ...(name !== undefined && { name }),
        ...(targetAudience !== undefined && { targetAudience }),
        ...(campaignType !== undefined && { campaignType }),
        ...(frequencyType !== undefined && { frequencyType }),
        ...(frequencyCount !== undefined && { frequencyCount }),
        ...(timeStart !== undefined && { timeStart }),
        ...(timeEnd !== undefined && { timeEnd }),
        ...(status !== undefined && { status }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        updatedAt: now,
      })
      .where(eq(campaigns.id, id));

    if (platformIds !== undefined) {
      await db.delete(campaignPlatforms).where(eq(campaignPlatforms.campaignId, id));
      if (Array.isArray(platformIds) && platformIds.length > 0) {
        await db.insert(campaignPlatforms).values(
          platformIds.map((platformId: string) => ({ campaignId: id, platformId }))
        );
      }
    }
    if (countryCodes !== undefined) {
      await db.delete(campaignCountries).where(eq(campaignCountries.campaignId, id));
      if (Array.isArray(countryCodes) && countryCodes.length > 0) {
        await db.insert(campaignCountries).values(
          countryCodes.map((code: string) => ({ campaignId: id, countryCode: code.toUpperCase().slice(0, 2) }))
        );
      }
    }
    if (adId !== undefined) {
      await db.delete(campaignAd).where(eq(campaignAd.campaignId, id));
      if (adId) {
        await db.insert(campaignAd).values({ campaignId: id, adId });
      }
    }
    if (notificationId !== undefined) {
      await db.delete(campaignNotification).where(eq(campaignNotification.campaignId, id));
      if (notificationId) {
        await db.insert(campaignNotification).values({ campaignId: id, notificationId });
      }
    }

    const campaign = await getCampaignWithRelations(id);
    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

// DELETE campaign (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const [existing] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    await db.delete(campaigns).where(eq(campaigns.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
