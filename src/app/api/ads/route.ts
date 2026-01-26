import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { ads, platforms } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';

// Helper function to auto-expire ads based on end date
async function autoExpireAds() {
  const now = new Date();
  await db
    .update(ads)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(ads.status, 'active'),
        lt(ads.endDate, now)
      )
    );
}

// GET all ads with platform info (optionally filter by domain for extension use)
export async function GET(request: NextRequest) {
  try {
    // Auto-expire ads that have passed their end date
    await autoExpireAds();

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    // If domain is provided, filter ads for that domain (for extension use)
    if (domain) {
      // Find platform by domain
      const [platform] = await db
        .select()
        .from(platforms)
        .where(eq(platforms.domain, domain))
        .limit(1);

      if (!platform) {
        return NextResponse.json([]);
      }

      // Get active ads for this platform
      const activeAds = await db
        .select({
          id: ads.id,
          name: ads.name,
          description: ads.description,
          imageUrl: ads.imageUrl,
          targetUrl: ads.targetUrl,
          status: ads.status,
          startDate: ads.startDate,
          endDate: ads.endDate,
        })
        .from(ads)
        .where(
          and(
            eq(ads.platformId, platform.id),
            eq(ads.status, 'active')
          )
        )
        .orderBy(ads.createdAt);

      return NextResponse.json(activeAds);
    }

    // Return all ads for admin dashboard
    const allAds = await db
      .select({
        id: ads.id,
        name: ads.name,
        description: ads.description,
        imageUrl: ads.imageUrl,
        targetUrl: ads.targetUrl,
        platformId: ads.platformId,
        status: ads.status,
        startDate: ads.startDate,
        endDate: ads.endDate,
        createdAt: ads.createdAt,
        updatedAt: ads.updatedAt,
        platformName: platforms.name,
        platformDomain: platforms.domain,
      })
      .from(ads)
      .leftJoin(platforms, eq(ads.platformId, platforms.id))
      .orderBy(ads.createdAt);

    return NextResponse.json(allAds);
  } catch (error) {
    console.error('Error fetching ads:', error);
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 });
  }
}

// POST create new ad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, imageUrl, targetUrl, platformId, status, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Determine status based on dates if not explicitly set
    let finalStatus = status || 'inactive';
    const now = new Date();
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < now) {
        finalStatus = 'expired';
      } else if (start <= now && end >= now) {
        finalStatus = 'active';
      } else if (start > now) {
        finalStatus = 'scheduled';
      }
    }

    const [newAd] = await db
      .insert(ads)
      .values({
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        platformId: platformId === '__none__' ? null : platformId || null,
        status: finalStatus,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      })
      .returning();

    return NextResponse.json(newAd, { status: 201 });
  } catch (error) {
    console.error('Error creating ad:', error);
    return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 });
  }
}
