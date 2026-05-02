import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { redirects } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { queryPlatformConflictForRedirect } from '@/lib/redirect-platform-conflict-queries';
import { getLinkedCampaignCountByRedirectId } from '@/lib/campaign-linked-counts';
import { normalizeDomainForRedirectStorage } from '@/lib/domain-utils';
import { parsePagination } from '@/lib/pagination';
import { publishRedirectsUpdated } from '@/lib/redis';
import { publishCampaignUpdatedForLinkedRedirect } from '@/lib/campaign-linked-counts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { limit, offset } = parsePagination(request);
    const [allRedirects, linkedByRedirectId] = await Promise.all([
      db.select().from(redirects).orderBy(redirects.createdAt).limit(limit).offset(offset),
      getLinkedCampaignCountByRedirectId(),
    ]);

    const data = allRedirects.map((row) => ({
      ...row,
      linkedCampaignCount: linkedByRedirectId.get(row.id) ?? 0,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching redirects:', error);
    return NextResponse.json({ error: 'Failed to fetch redirects' }, { status: 500 });
  }
}

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
    const { name, sourceDomain, includeSubdomains, destinationUrl } = body;

    if (!name || !sourceDomain || !destinationUrl) {
      return NextResponse.json(
        { error: 'name, sourceDomain, and destinationUrl are required' },
        { status: 400 }
      );
    }

    const includeSub = Boolean(includeSubdomains);
    const normalizedSource = normalizeDomainForRedirectStorage(String(sourceDomain), includeSub);
    const conflictHost = await queryPlatformConflictForRedirect(normalizedSource, includeSub);
    if (conflictHost !== undefined) {
      return NextResponse.json(
        {
          error: `Source domain overlaps an existing platform hostname (${conflictHost}). Change the rule or remove the platform first.`,
        },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(redirects)
      .values({
        name,
        sourceDomain: normalizedSource,
        includeSubdomains: includeSub,
        destinationUrl: String(destinationUrl).trim(),
      })
      .returning();

    await publishRedirectsUpdated();
    await publishCampaignUpdatedForLinkedRedirect(created.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating redirect:', error);
    return NextResponse.json({ error: 'Failed to create redirect' }, { status: 500 });
  }
}
