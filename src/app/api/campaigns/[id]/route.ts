import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaigns, enduserEvents, notifications, targetLists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { formatCampaignResponse, getAccessibleCampaignById } from '@/lib/campaign-access';
import { getSessionWithRole } from '@/lib/dal';
import {
  publishCampaignUpdated,
  publishRealtimeNotification,
  publishRedirectsUpdated,
} from '@/lib/redis';
import { ensureCampaignStatusDeletedEnumReady } from '@/lib/db/run-migrate';
import { resolveCampaignTargetAudienceForUpdate } from '@/lib/campaign-api-target-payload';

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
    const existing = await getAccessibleCampaignById(sessionWithRole, id);
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
      redirectId,
      targetListId,
    } = body;

    let nextTargetListId: string | null | undefined = undefined;
    if (targetListId !== undefined) {
      if (targetListId === null || targetListId === '') {
        nextTargetListId = null;
      } else {
        const [tl] = await db
          .select({ id: targetLists.id })
          .from(targetLists)
          .where(eq(targetLists.id, String(targetListId)))
          .limit(1);
        if (!tl) {
          return NextResponse.json({ error: 'target list not found' }, { status: 400 });
        }
        nextTargetListId = tl.id;
      }
    }

    if (status === 'deleted') {
      return NextResponse.json(
        { error: 'Use DELETE to remove a campaign; status cannot be set to deleted via update' },
        { status: 400 }
      );
    }

    if (existing.status === 'deleted') {
      const nextStatus = status ?? existing.status;
      if (nextStatus !== 'active' && nextStatus !== 'inactive') {
        return NextResponse.json(
          {
            error:
              'This campaign was deleted. Set status to active or inactive to restore it (and send the rest of the campaign fields as needed).',
          },
          { status: 400 }
        );
      }
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

    const audienceUpdate = resolveCampaignTargetAudienceForUpdate(
      existing.targetListId ?? null,
      nextTargetListId,
      targetAudience
    );

    const now = new Date();
    await db
      .update(campaigns)
      .set({
        ...(name !== undefined && { name }),
        ...(audienceUpdate !== undefined && { targetAudience: audienceUpdate }),
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
        ...(nextTargetListId !== undefined && { targetListId: nextTargetListId }),
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

function isPermanentDeleteQuery(request: NextRequest): boolean {
  const v = request.nextUrl.searchParams.get('permanent');
  return v === '1' || v?.toLowerCase() === 'true';
}

// DELETE campaign (admin only): default soft-delete; `?permanent=1` removes campaign row and related enduser_events
export async function DELETE(
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

    if (isPermanentDeleteQuery(request)) {
      await publishCampaignUpdated(id);
      await db.transaction(async (tx) => {
        await tx.delete(enduserEvents).where(eq(enduserEvents.campaignId, id));
        await tx.delete(campaigns).where(eq(campaigns.id, id));
      });
      await publishRedirectsUpdated();
      return NextResponse.json({ success: true, permanent: true });
    }

    if (existing.status === 'deleted') {
      return NextResponse.json({ success: true, softDeleted: true, alreadySoftDeleted: true });
    }

    const now = new Date();
    await ensureCampaignStatusDeletedEnumReady();
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
