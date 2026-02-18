import { NextResponse } from 'next/server';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCanonicalDisplayDomain } from '@/lib/domain-utils';

/**
 * GET /api/extension/domains
 *
 * Public API - no auth required.
 * Returns all active target domains where the extension will load ads and notifications.
 * Use this to know which domains to make ad-block requests for.
 *
 * Response: { "domains": ["instagram.com", "youtube.com", ...] }
 */
export async function GET() {
  try {
    const rows = await db
      .select({ domain: platforms.domain })
      .from(platforms)
      .where(eq(platforms.isActive, true));

    const domains = rows
      .map((r) => (r.domain ?? '').trim())
      .filter(Boolean)
      .map((d) => getCanonicalDisplayDomain(d))
      .filter((d, i, arr) => arr.indexOf(d) === i); // dedupe by canonical form

    return NextResponse.json({ domains });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
