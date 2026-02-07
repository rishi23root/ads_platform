import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';

// GET all notifications (global, no domain filtering)
export async function GET() {
  try {
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

// POST create new notification (global, no platform/domain required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, message, startDate, endDate } = body;

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

    // Create the notification (global, no platform association)
    const [newNotification] = await db
      .insert(notifications)
      .values({
        title,
        message,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .returning();

    return NextResponse.json(newNotification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
