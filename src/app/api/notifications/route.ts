import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { notifications, notificationPlatforms, platforms } from '@/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

// GET all notifications (optionally filter by domain for extension use)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    // If domain is provided, filter notifications for that domain and within date range
    if (domain) {
      const now = new Date();

      // Find platform by domain
      const [platform] = await db
        .select()
        .from(platforms)
        .where(eq(platforms.domain, domain))
        .limit(1);

      if (!platform) {
        return NextResponse.json([]);
      }

      // Get active notifications for this platform
      const activeNotifications = await db
        .select({
          id: notifications.id,
          title: notifications.title,
          message: notifications.message,
          startDate: notifications.startDate,
          endDate: notifications.endDate,
        })
        .from(notifications)
        .innerJoin(notificationPlatforms, eq(notifications.id, notificationPlatforms.notificationId))
        .where(
          and(
            eq(notificationPlatforms.platformId, platform.id),
            lte(notifications.startDate, now),
            gte(notifications.endDate, now)
          )
        )
        .orderBy(notifications.createdAt);

      return NextResponse.json(activeNotifications);
    }

    // Return all notifications for admin dashboard
    const allNotifications = await db
      .select()
      .from(notifications)
      .orderBy(notifications.createdAt);

    return NextResponse.json(allNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST create new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, message, startDate, endDate, platformIds } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    if (!platformIds || !Array.isArray(platformIds) || platformIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one platform/domain is required' },
        { status: 400 }
      );
    }

    // Create the notification
    const [newNotification] = await db
      .insert(notifications)
      .values({
        title,
        message,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .returning();

    // Create notification-platform mappings
    await db.insert(notificationPlatforms).values(
      platformIds.map((platformId: string) => ({
        notificationId: newNotification.id,
        platformId,
      }))
    );

    return NextResponse.json(newNotification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
