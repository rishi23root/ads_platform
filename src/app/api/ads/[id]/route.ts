import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { ads } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET single ad
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const [ad] = await db
      .select()
      .from(ads)
      .where(eq(ads.id, id))
      .limit(1);

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    return NextResponse.json(ad);
  } catch (error) {
    console.error('Error fetching ad:', error);
    return NextResponse.json({ error: 'Failed to fetch ad' }, { status: 500 });
  }
}

// PUT update ad (admin only)
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
    const { name, description, imageUrl, targetUrl, htmlCode } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [updatedAd] = await db
      .update(ads)
      .set({
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        htmlCode: htmlCode ?? null,
        updatedAt: new Date(),
      })
      .where(eq(ads.id, id))
      .returning();

    if (!updatedAd) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    return NextResponse.json(updatedAd);
  } catch (error) {
    console.error('Error updating ad:', error);
    return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 });
  }
}

// DELETE ad (admin only)
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

    const [deletedAd] = await db
      .delete(ads)
      .where(eq(ads.id, id))
      .returning();

    if (!deletedAd) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ad:', error);
    return NextResponse.json({ error: 'Failed to delete ad' }, { status: 500 });
  }
}
