import { NextResponse } from 'next/server';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { getCanonicalDisplayDomain } from '@/lib/domain-utils';

/**
 * GET /api/extension/domains — public platform hostnames (no auth).
 *
 * Input: none.
 *
 * Output: `200` `{ domains: string[] }` (canonical, deduped) | `500` `{ error: "Failed to fetch domains" }`.
 */
export async function GET() {
  try {
    const rows = await db.select({ domain: platforms.domain }).from(platforms);

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
