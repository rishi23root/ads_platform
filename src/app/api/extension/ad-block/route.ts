import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  ads,
  platforms,
  adPlatforms,
  extensionUsers,
  requestLogs,
  notifications,
  notificationReads,
} from '@/db/schema';
import { eq, and, lt, lte, gte, isNull } from 'drizzle-orm';

function normalizeDomainForMatch(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  try {
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname;
  } catch {
    return trimmed;
  }
}

function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.'); // e.g., "instagram.com"
  }
  return hostname;
}

function domainsMatch(domain1: string, domain2: string): boolean {
  const host1 = normalizeDomainForMatch(domain1);
  const host2 = normalizeDomainForMatch(domain2);
  
  // Exact match
  if (host1 === host2) return true;
  
  // Root domain match (e.g., instagram.com matches www.instagram.com)
  const root1 = extractRootDomain(host1);
  const root2 = extractRootDomain(host2);
  return root1 === root2 && root1.length > 0;
}

async function autoExpireAds() {
  const now = new Date();
  await db
    .update(ads)
    .set({ status: 'expired', updatedAt: now })
    .where(and(eq(ads.status, 'active'), lt(ads.endDate, now)));
}

/**
 * POST /api/extension/ad-block
 * Returns public-safe ad and/or notification fields for the extension.
 * If requestType is omitted, returns both ads and notifications and logs both.
 * 
 * Request body: { visitorId: string, domain: string, requestType?: "ad" | "notification" }
 * Response: { ads: [...], notifications: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    // Check Content-Type header
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        },
        { status: 400 }
      );
    }

    const { visitorId, domain, requestType } = body;

    // Validate required fields
    if (!visitorId || !domain) {
      return NextResponse.json(
        { error: 'visitorId and domain are required' },
        { status: 400 }
      );
    }

    // Validate requestType if provided
    if (requestType !== undefined && requestType !== 'ad' && requestType !== 'notification') {
      return NextResponse.json(
        { error: 'requestType must be either "ad" or "notification"' },
        { status: 400 }
      );
    }

    // Determine what to fetch: if requestType omitted, fetch both
    const shouldFetchAds = requestType === undefined || requestType === 'ad';
    const shouldFetchNotifications =
      requestType === undefined || requestType === 'notification';

    // Resolve platform by domain (with root domain matching)
    const allPlatforms = await db
      .select({ id: platforms.id, domain: platforms.domain })
      .from(platforms)
      .where(eq(platforms.isActive, true));

    const platform = allPlatforms.find((p) => domainsMatch(p.domain, domain));

    // If no platform found, return empty arrays (200, not 404)
    if (!platform) {
      return NextResponse.json({ ads: [], notifications: [] });
    }

    const now = new Date();
    let publicAds: Array<{
      title: string;
      image: string | null;
      description: string | null;
      redirectUrl: string | null;
    }> = [];
    let publicNotifications: Array<{ title: string; message: string }> = [];

    // Fetch ads if needed
    if (shouldFetchAds) {
      await autoExpireAds();

      const activeAds = await db
        .select({
          name: ads.name,
          description: ads.description,
          imageUrl: ads.imageUrl,
          targetUrl: ads.targetUrl,
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

      publicAds = activeAds.map((ad) => ({
        title: ad.name,
        image: ad.imageUrl,
        description: ad.description ?? null,
        redirectUrl: ad.targetUrl ?? null,
      }));
    }

    // Fetch notifications if needed (global, filtered by read status)
    if (shouldFetchNotifications) {
      // Fetch active notifications that haven't been read by this visitor using left join
      const activeNotifications = await db
        .select({
          id: notifications.id,
          title: notifications.title,
          message: notifications.message,
        })
        .from(notifications)
        .leftJoin(
          notificationReads,
          and(
            eq(notificationReads.notificationId, notifications.id),
            eq(notificationReads.visitorId, visitorId)
          )
        )
        .where(
          and(
            lte(notifications.startDate, now),
            gte(notifications.endDate, now),
            isNull(notificationReads.id) // Only get unread notifications
          )
        )
        .orderBy(notifications.createdAt);

      publicNotifications = activeNotifications.map((notif) => ({
        title: notif.title,
        message: notif.message,
      }));

      // Record that these notifications were pulled by this visitor
      // Insert all at once - unique constraint will prevent duplicates
      if (activeNotifications.length > 0) {
        try {
          await db.insert(notificationReads).values(
            activeNotifications.map((notif) => ({
              notificationId: notif.id,
              visitorId,
            }))
          );
        } catch (error) {
          console.error('Error recording notification reads:', error);
          // If there are any conflicts (duplicate reads), that's fine
          // The unique constraint ensures we don't track duplicates
          // This can happen in race conditions or if notifications were already read
        }
      }
    }

    // Visit logging: upsert extension_users and insert request_logs
    const existingUser = await db
      .select()
      .from(extensionUsers)
      .where(eq(extensionUsers.visitorId, visitorId))
      .limit(1);

    let logCount = 0;
    if (shouldFetchAds) logCount++;
    if (shouldFetchNotifications) logCount++;

    if (existingUser.length > 0) {
      // Update existing user
      const currentTotal = existingUser[0].totalRequests;
      await db
        .update(extensionUsers)
        .set({
          lastSeenAt: now,
          totalRequests: currentTotal + logCount,
          updatedAt: now,
        })
        .where(eq(extensionUsers.visitorId, visitorId));
    } else {
      // Create new user
      await db.insert(extensionUsers).values({
        visitorId,
        firstSeenAt: now,
        lastSeenAt: now,
        totalRequests: logCount,
      });
    }

    // Insert request logs (one per type)
    if (shouldFetchAds) {
      await db.insert(requestLogs).values({
        visitorId,
        domain,
        requestType: 'ad',
      });
    }
    if (shouldFetchNotifications) {
      await db.insert(requestLogs).values({
        visitorId,
        domain,
        requestType: 'notification',
      });
    }

    return NextResponse.json({
      ads: publicAds,
      notifications: publicNotifications,
    });
  } catch (error) {
    console.error('Error fetching extension ad block:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      { error: 'Failed to fetch ad block', ...(isDev && { details: message }) },
      { status: 500 }
    );
  }
}
