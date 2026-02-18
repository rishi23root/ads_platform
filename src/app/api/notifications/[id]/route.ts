import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET single notification
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    return NextResponse.json({ error: 'Failed to fetch notification' }, { status: 500 });
  }
}

// PUT update notification (content-only) (admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { title, message, ctaLink } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    const [updatedNotification] = await db
      .update(notifications)
      .set({
        title,
        message,
        ctaLink: ctaLink ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();

    if (!updatedNotification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(updatedNotification);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

// DELETE notification (admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
