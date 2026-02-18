import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';
import { publishRealtimeNotification } from '@/lib/redis';
import { getSessionWithRole } from '@/lib/dal';

// GET all notifications (global, no domain filtering)
export async function GET() {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

// POST create new notification (content-only, no dates) (admin only)
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
    const { title, message, ctaLink } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    const [newNotification] = await db
      .insert(notifications)
      .values({
        title,
        message,
        ctaLink: ctaLink ?? null,
      })
      .returning();

    if (newNotification) {
      await publishRealtimeNotification(
        JSON.stringify({
          type: 'new',
          id: newNotification.id,
          title: newNotification.title,
          message: newNotification.message,
        })
      );
    }

    return NextResponse.json(newNotification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
