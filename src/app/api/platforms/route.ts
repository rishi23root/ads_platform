import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';
import { normalizeDomain } from '@/lib/domain-utils';
import { parsePagination } from '@/lib/pagination';
import { queryRedirectConflictForPlatform } from '@/lib/redirect-platform-conflict-queries';
import { publishPlatformsUpdated } from '@/lib/redis';

// GET all platforms
export async function GET(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { limit, offset } = parsePagination(request);
    const allPlatforms = await db
      .select()
      .from(platforms)
      .orderBy(platforms.createdAt)
      .limit(limit)
      .offset(offset);
    return NextResponse.json(allPlatforms);
  } catch (error) {
    console.error('Error fetching platforms:', error);
    return NextResponse.json({ error: 'Failed to fetch platforms' }, { status: 500 });
  }
}

// POST create new platform (admin only)
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
    const { name, domain } = body as { name?: unknown; domain?: unknown };

    if (typeof name !== 'string' || typeof domain !== 'string' || !name || !domain) {
      return NextResponse.json(
        { error: 'Name and domain are required' },
        { status: 400 }
      );
    }

    // Normalize domain (extract hostname from URL if needed)
    const normalizedDomain = normalizeDomain(domain);

    const redirectHit = await queryRedirectConflictForPlatform(normalizedDomain);
    if (redirectHit !== undefined) {
      return NextResponse.json(
        {
          error: `This domain is already covered by a redirect rule (source: ${redirectHit.sourceDomain}). Change or remove the redirect first.`,
        },
        { status: 409 }
      );
    }

    // Check if name or domain already exists
    const [existingByName, existingByDomain] = await Promise.all([
      db.select().from(platforms).where(eq(platforms.name, name)).limit(1),
      db.select().from(platforms).where(eq(platforms.domain, normalizedDomain)).limit(1),
    ]);

    if (existingByName.length > 0) {
      return NextResponse.json(
        { error: 'A platform with this name already exists' },
        { status: 409 }
      );
    }
    if (existingByDomain.length > 0) {
      return NextResponse.json(
        { error: 'A platform with this domain already exists' },
        { status: 409 }
      );
    }

    const [newPlatform] = await db
      .insert(platforms)
      .values({
        name,
        domain: normalizedDomain,
      })
      .returning();

    if (newPlatform) {
      await publishPlatformsUpdated();
    }

    return NextResponse.json(newPlatform, { status: 201 });
  } catch (error) {
    console.error('Error creating platform:', error);
    return NextResponse.json({ error: 'Failed to create platform' }, { status: 500 });
  }
}
