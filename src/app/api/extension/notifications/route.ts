import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  extensionUsers,
  requestLogs,
  notifications,
  notificationReads,
} from '@/db/schema';
import { eq, and, lte, gte, isNull } from 'drizzle-orm';

/**
 * POST /api/extension/notifications
 * Returns global notifications this user has not yet pulled. No domain required.
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

    // Fetch active notifications not yet read by this visitor
    const activeNotifications = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
      })
      .from(notifications)
      .leftJoin(
        notificationReads,
        and(
          eq(notificationReads.notificationId, notifications.id),
          eq(notificationReads.visitorId, visitorId)
        )
      )
      .where(
        and(
          lte(notifications.startDate, now),
          gte(notifications.endDate, now),
          isNull(notificationReads.id)
        )
      )
      .orderBy(notifications.createdAt);

    const publicNotifications = activeNotifications.map((notif) => ({
      title: notif.title,
      message: notif.message,
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
    }

    // Upsert extension_users and insert request_log (no domain — use sentinel)
    const existingUser = await db
      .select()
      .from(extensionUsers)
      .where(eq(extensionUsers.visitorId, visitorId))
      .limit(1);

    if (existingUser.length > 0) {
      await db
        .update(extensionUsers)
        .set({
          lastSeenAt: now,
          totalRequests: existingUser[0].totalRequests + 1,
          updatedAt: now,
        })
        .where(eq(extensionUsers.visitorId, visitorId));
    } else {
      await db.insert(extensionUsers).values({
        visitorId,
        firstSeenAt: now,
        lastSeenAt: now,
        totalRequests: 1,
      });
    }

    await db.insert(requestLogs).values({
      visitorId,
      domain: 'extension',
      requestType: 'notification',
    });

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
