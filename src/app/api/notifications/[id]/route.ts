import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { notifications, notificationPlatforms, platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET single notification with its platforms
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Get associated platforms
    const associatedPlatforms = await db
      .select({
        platformId: notificationPlatforms.platformId,
        platformName: platforms.name,
        platformDomain: platforms.domain,
      })
      .from(notificationPlatforms)
      .innerJoin(platforms, eq(notificationPlatforms.platformId, platforms.id))
      .where(eq(notificationPlatforms.notificationId, id));

    return NextResponse.json({
      ...notification,
      platforms: associatedPlatforms,
      platformIds: associatedPlatforms.map((p) => p.platformId),
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    return NextResponse.json({ error: 'Failed to fetch notification' }, { status: 500 });
  }
}

// PUT update notification
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    // Update the notification
    const [updatedNotification] = await db
      .update(notifications)
      .set({
        title,
        message,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();

    if (!updatedNotification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Delete existing platform mappings
    await db
      .delete(notificationPlatforms)
      .where(eq(notificationPlatforms.notificationId, id));

    // Create new platform mappings
    await db.insert(notificationPlatforms).values(
      platformIds.map((platformId: string) => ({
        notificationId: id,
        platformId,
      }))
    );

    return NextResponse.json(updatedNotification);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

// DELETE notification (cascade will handle notificationPlatforms)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [deletedNotification] = await db
      .delete(notifications)
      .where(eq(notifications.id, id))
      .returning();

    if (!deletedNotification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
