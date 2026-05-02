import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { notifications } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { parseListPagination } from '@/lib/api-pagination';
import { getSessionWithRole } from '@/lib/dal';
import { getLinkedCampaignCountByNotificationIdForIds } from '@/lib/campaign-linked-counts';

// GET notifications (paginated: ?page=1&pageSize=50)
export async function GET(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseListPagination(searchParams);

    const [rows, countRow] = await Promise.all([
      db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(notifications),
    ]);

    const linkedByNotificationId =
      rows.length === 0
        ? new Map<string, number>()
        : await getLinkedCampaignCountByNotificationIdForIds(rows.map((r) => r.id));

    const totalCount = Number(countRow[0]?.count ?? 0);

    const data = rows.map((row) => ({
      ...row,
      linkedCampaignCount: linkedByNotificationId.get(row.id) ?? 0,
    }));

    return NextResponse.json({
      data,
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    });
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

    return NextResponse.json(newNotification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
