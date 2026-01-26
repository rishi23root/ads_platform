import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { ads } from '@/db/schema';
import { eq } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET single ad
export async function GET(request: NextRequest, context: RouteContext) {
  try {
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

// PUT update ad
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, description, imageUrl, targetUrl, platformId, status, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Determine status based on dates if not explicitly set
    let finalStatus = status;
    const now = new Date();
    if (startDate && endDate && !status) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < now) {
        finalStatus = 'expired';
      } else if (start <= now && end >= now) {
        finalStatus = 'active';
      } else if (start > now) {
        finalStatus = 'scheduled';
      } else {
        finalStatus = 'inactive';
      }
    } else if (!finalStatus) {
      finalStatus = 'inactive';
    }

    const [updatedAd] = await db
      .update(ads)
      .set({
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        platformId: platformId === '__none__' ? null : platformId || null,
        status: finalStatus,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
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

// DELETE ad
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
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
