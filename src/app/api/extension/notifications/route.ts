import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  notifications,
  notificationReads,
  visitors,
  requestLogs,
  campaignNotification,
  campaigns,
} from '@/db/schema';
import { eq, and, isNull, sql, or, lte, gte } from 'drizzle-orm';

/**
 * POST /api/extension/notifications
 * Returns global notifications this user has not yet pulled. No domain required.
 * Filters by campaign startDate, endDate, and status (only active campaigns in date range).
 * Body: { visitorId: string }
 * Response: { notifications: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    let body: { visitorId?: string };
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        },
        { status: 400 }
      );
    }

    const { visitorId } = body;
    if (!visitorId || typeof visitorId !== 'string') {
      return NextResponse.json(
        { error: 'visitorId is required' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Upsert visitors (update lastSeenAt, increment totalRequests)
    await db
      .insert(visitors)
      .values({
        visitorId,
        totalRequests: 1,
        createdAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: visitors.visitorId,
        set: {
          lastSeenAt: now,
          totalRequests: sql`${visitors.totalRequests} + 1`,
        },
      });

    // Fetch notifications not yet read by this visitor, filtered by campaign dates and status
    const activeNotifications = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        ctaLink: notifications.ctaLink,
      })
      .from(notifications)
      .innerJoin(campaignNotification, eq(campaignNotification.notificationId, notifications.id))
      .innerJoin(campaigns, eq(campaigns.id, campaignNotification.campaignId))
      .leftJoin(
        notificationReads,
        and(
          eq(notificationReads.notificationId, notifications.id),
          eq(notificationReads.visitorId, visitorId)
        )
      )
      .where(
        and(
          isNull(notificationReads.id),
          eq(campaigns.status, 'active'),
          or(isNull(campaigns.startDate), lte(campaigns.startDate, now)),
          or(isNull(campaigns.endDate), gte(campaigns.endDate, now))
        )
      )
      .orderBy(notifications.createdAt);

    const publicNotifications = activeNotifications.map((notif) => ({
      title: notif.title,
      message: notif.message,
      ctaLink: notif.ctaLink ?? null,
    }));

    // Record that these notifications were pulled by this visitor
    if (activeNotifications.length > 0) {
      try {
        await db.insert(notificationReads).values(
          activeNotifications.map((notif) => ({
            notificationId: notif.id,
            visitorId,
          }))
        );
      } catch {
        // Ignore duplicate key (already read)
      }
      // Insert request_logs only when user actually receives data (user-guided logging)
      await db.insert(requestLogs).values({
        visitorId,
        domain: 'extension',
        requestType: 'notification',
      });
    }

    return NextResponse.json({ notifications: publicNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      { error: 'Failed to fetch notifications', ...(isDev && { details: message }) },
      { status: 500 }
    );
  }
}
