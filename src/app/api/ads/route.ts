import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { ads } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';

// GET all ads (content-only, no platform/status/dates)
export async function GET() {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allAds = await db.select().from(ads).orderBy(ads.createdAt);
    return NextResponse.json(allAds);
  } catch (error) {
    console.error('Error fetching ads:', error);
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 });
  }
}

// POST create new ad (admin only)
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
    const { name, description, imageUrl, targetUrl, htmlCode } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [newAd] = await db
      .insert(ads)
      .values({
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        htmlCode: htmlCode ?? null,
      })
      .returning();

    return NextResponse.json(newAd, { status: 201 });
  } catch (error) {
    console.error('Error creating ad:', error);
    return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 });
  }
}
