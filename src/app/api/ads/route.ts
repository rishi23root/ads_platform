import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { ads, platforms, adPlatforms } from '@/db/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';

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

      // Get active ads linked to this platform via ad_platforms
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
        .innerJoin(adPlatforms, eq(ads.id, adPlatforms.adId))
        .where(
          and(
            eq(adPlatforms.platformId, platform.id),
            eq(ads.status, 'active')
          )
        )
        .orderBy(ads.createdAt);

      return NextResponse.json(activeAds);
    }

    // Return all ads for admin dashboard with their platforms (from ad_platforms)
    const allAds = await db.select().from(ads).orderBy(ads.createdAt);
    const adIds = allAds.map((a) => a.id);
    const links =
      adIds.length > 0
        ? await db
            .select({
              adId: adPlatforms.adId,
              platformId: platforms.id,
              platformName: platforms.name,
              platformDomain: platforms.domain,
            })
            .from(adPlatforms)
            .innerJoin(platforms, eq(adPlatforms.platformId, platforms.id))
            .where(inArray(adPlatforms.adId, adIds))
        : [];

    const platformsByAdId = links.reduce<Record<string, { id: string; name: string; domain: string }[]>>(
      (acc, row) => {
        if (!acc[row.adId]) acc[row.adId] = [];
        acc[row.adId].push({
          id: row.platformId,
          name: row.platformName,
          domain: row.platformDomain,
        });
        return acc;
      },
      {}
    );

    const allAdsWithPlatforms = allAds.map((ad) => ({
      id: ad.id,
      name: ad.name,
      description: ad.description,
      imageUrl: ad.imageUrl,
      targetUrl: ad.targetUrl,
      platformId: ad.platformId,
      status: ad.status,
      startDate: ad.startDate,
      endDate: ad.endDate,
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt,
      platforms: platformsByAdId[ad.id] ?? [],
      platformName: platformsByAdId[ad.id]?.[0]?.name ?? null,
      platformDomain: platformsByAdId[ad.id]?.[0]?.domain ?? null,
    }));

    return NextResponse.json(allAdsWithPlatforms);
  } catch (error) {
    console.error('Error fetching ads:', error);
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 });
  }
}

// POST create new ad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, imageUrl, targetUrl, platformIds, status, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const safePlatformIds = Array.isArray(platformIds)
      ? platformIds.filter((id: unknown) => typeof id === 'string' && id)
      : [];

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
        platformId: safePlatformIds[0] ?? null,
        status: finalStatus,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      })
      .returning();

    if (newAd && safePlatformIds.length > 0) {
      await db.insert(adPlatforms).values(
        safePlatformIds.map((platformId: string) => ({ adId: newAd.id, platformId }))
      );
    }

    return NextResponse.json(newAd, { status: 201 });
  } catch (error) {
    console.error('Error creating ad:', error);
    return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 });
  }
}
