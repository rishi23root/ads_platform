import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaigns, notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { formatCampaignResponse, getAccessibleCampaignById } from '@/lib/campaign-access';
import { getSessionWithRole } from '@/lib/dal';
import { publishCampaignUpdated, publishRealtimeNotification } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function getCampaignWithRelations(id: string) {
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) return null;

  return {
    ...c,
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
    adId: c.adId ?? null,
    notificationId: c.notificationId ?? null,
    redirectId: c.redirectId ?? null,
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
    const row = await getAccessibleCampaignById(sessionWithRole, id);
    if (!row) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json(formatCampaignResponse(row));
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
    if (existing.status === 'deleted') {
      return NextResponse.json(
        { error: 'Campaign was deleted and cannot be edited' },
        { status: 410 }
      );
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
      redirectId,
    } = body;

    if (status === 'deleted') {
      return NextResponse.json(
        { error: 'Use DELETE to remove a campaign; status cannot be set to deleted via update' },
        { status: 400 }
      );
    }

    const effectiveCampaignType = campaignType ?? existing.campaignType;
    const effectivePlatformIds =
      platformIds ?? (existing.platformIds?.length ? [...existing.platformIds] : []);
    if (
      effectiveCampaignType !== 'notification' &&
      effectiveCampaignType !== 'redirect' &&
      (!Array.isArray(effectivePlatformIds) || effectivePlatformIds.length === 0)
    ) {
      return NextResponse.json(
        { error: 'Select at least one domain (platform)' },
        { status: 400 }
      );
    }
    if (effectiveCampaignType === 'ads' || effectiveCampaignType === 'popup') {
      const effectiveAdId = adId !== undefined ? adId : existing.adId;
      if (!effectiveAdId) {
        return NextResponse.json(
          { error: `Select an ${effectiveCampaignType === 'popup' ? 'pop up' : 'ad'}` },
          { status: 400 }
        );
      }
    } else if (effectiveCampaignType === 'notification') {
      const effectiveNotifId = notificationId !== undefined ? notificationId : existing.notificationId;
      if (!effectiveNotifId) {
        return NextResponse.json(
          { error: 'Select a notification' },
          { status: 400 }
        );
      }
    } else if (effectiveCampaignType === 'redirect') {
      const effectiveRedirectId = redirectId !== undefined ? redirectId : existing.redirectId;
      if (!effectiveRedirectId) {
        return NextResponse.json(
          { error: 'Select a redirect' },
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
        ...(adId !== undefined && { adId: adId ?? null }),
        ...(notificationId !== undefined && { notificationId: notificationId ?? null }),
        ...(redirectId !== undefined && { redirectId: redirectId ?? null }),
        ...(platformIds !== undefined && {
          platformIds: Array.isArray(platformIds) ? platformIds : [],
        }),
        ...(countryCodes !== undefined && {
          countryCodes: Array.isArray(countryCodes)
            ? countryCodes.map((code: string) => code.toUpperCase().slice(0, 2))
            : [],
        }),
        updatedAt: now,
      })
      .where(eq(campaigns.id, id));
    if (notificationId !== undefined && notificationId) {
      const [notif] = await db.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1);
      if (notif) {
        await publishRealtimeNotification(
          JSON.stringify({
            type: 'updated',
            id: notif.id,
            title: notif.title,
            message: notif.message,
          })
        );
      }
    }

    await publishCampaignUpdated(id);

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
    if (existing.status === 'deleted') {
      return NextResponse.json({ success: true, softDeleted: true });
    }

    const now = new Date();
    await publishCampaignUpdated(id);
    await db
      .update(campaigns)
      .set({ status: 'deleted', updatedAt: now })
      .where(eq(campaigns.id, id));
    return NextResponse.json({ success: true, softDeleted: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
