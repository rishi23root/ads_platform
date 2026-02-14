import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  notifications,
  notificationReads,
} from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * POST /api/extension/notifications
 * Returns global notifications this user has not yet pulled. No domain required.
 * Notifications are content-only; date filtering is on campaigns (handled by ad-block route).
 * This endpoint returns all unread notifications (simplified for MVP).
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

    // Fetch notifications not yet read by this visitor (content-only, no date filter)
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
      .where(isNull(notificationReads.id))
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
