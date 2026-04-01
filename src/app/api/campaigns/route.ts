import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaigns, notifications } from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { campaignRowNotSoftDeleted } from '@/lib/campaign-soft-delete-sql';
import { getSessionWithRole } from '@/lib/dal';
import { publishCampaignUpdated, publishRealtimeNotification } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET list campaigns (non-admin: own only; admin: all). Paginated: ?page=1&pageSize=50
export async function GET(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
    const offset = (page - 1) * pageSize;

    const includeDeleted =
      searchParams.get('includeDeleted') === '1' && sessionWithRole.role === 'admin';

    const scope =
      sessionWithRole.role === 'admin'
        ? undefined
        : eq(campaigns.createdBy, sessionWithRole.user.id);

    const hideDeletedFilter = includeDeleted ? undefined : campaignRowNotSoftDeleted;
    const listWhere =
      hideDeletedFilter && scope
        ? and(hideDeletedFilter, scope)
        : hideDeletedFilter ?? scope;

    const listQuery = db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        targetAudience: campaigns.targetAudience,
        campaignType: campaigns.campaignType,
        frequencyType: campaigns.frequencyType,
        frequencyCount: campaigns.frequencyCount,
        timeStart: campaigns.timeStart,
        timeEnd: campaigns.timeEnd,
        status: campaigns.status,
        createdBy: campaigns.createdBy,
        adId: campaigns.adId,
        notificationId: campaigns.notificationId,
        redirectId: campaigns.redirectId,
        platformIds: campaigns.platformIds,
        countryCodes: campaigns.countryCodes,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt))
      .limit(pageSize)
      .offset(offset);

    const countQuery = db.select({ count: sql<number>`count(*)` }).from(campaigns);

    const [list, countRow] = await Promise.all([
      listWhere ? listQuery.where(listWhere) : listQuery,
      listWhere ? countQuery.where(listWhere) : countQuery,
    ]);

    const totalCount = Number(countRow[0]?.count ?? 0);
    const result = list.map((c) => ({
      ...c,
      platformIds: [...(c.platformIds ?? [])],
      countryCodes: [...(c.countryCodes ?? [])],
    }));

    return NextResponse.json({
      data: result,
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    });
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
      redirectId,
    } = body;

    if (!name || !campaignType || !frequencyType) {
      return NextResponse.json(
        { error: 'name, campaignType, and frequencyType are required' },
        { status: 400 }
      );
    }

    if (status === 'deleted') {
      return NextResponse.json({ error: 'Cannot create a campaign as deleted' }, { status: 400 });
    }

    if (
      campaignType !== 'notification' &&
      campaignType !== 'redirect' &&
      (!Array.isArray(platformIds) || platformIds.length === 0)
    ) {
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
    if (campaignType === 'redirect' && !redirectId) {
      return NextResponse.json(
        { error: 'Select a redirect' },
        { status: 400 }
      );
    }

    const contentLinks =
      campaignType === 'ads' || campaignType === 'popup'
        ? { adId, notificationId: null as string | null, redirectId: null as string | null }
        : campaignType === 'notification'
          ? { adId: null as string | null, notificationId, redirectId: null as string | null }
          : { adId: null as string | null, notificationId: null as string | null, redirectId };

    const platformIdArray =
      Array.isArray(platformIds) && platformIds.length > 0 ? platformIds : ([] as string[]);
    const countryCodeArray =
      Array.isArray(countryCodes) && countryCodes.length > 0
        ? countryCodes.map((code: string) => code.toUpperCase().slice(0, 2))
        : ([] as string[]);

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
        adId: contentLinks.adId,
        notificationId: contentLinks.notificationId,
        redirectId: contentLinks.redirectId,
        platformIds: platformIdArray,
        countryCodes: countryCodeArray,
        createdBy: sessionWithRole.user.id,
      })
      .returning({ id: campaigns.id });

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    const campaignId = inserted.id;
    if (campaignType === 'notification' && notificationId) {
      const [notif] = await db.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1);
      if (notif) {
        await publishRealtimeNotification(
          JSON.stringify({
            type: 'new',
            id: notif.id,
            title: notif.title,
            message: notif.message,
          })
        );
      }
    }

    await publishCampaignUpdated(campaignId);

    return NextResponse.json({ id: campaignId });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
