import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { redirects } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { getLinkedCampaignCountByRedirectId } from '@/lib/campaign-linked-counts';
import { publishRedirectsUpdated } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [allRedirects, linkedByRedirectId] = await Promise.all([
      db.select().from(redirects).orderBy(redirects.createdAt),
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

    const [created] = await db
      .insert(redirects)
      .values({
        name,
        sourceDomain: String(sourceDomain).trim(),
        includeSubdomains: Boolean(includeSubdomains),
        destinationUrl: String(destinationUrl).trim(),
      })
      .returning();

    await publishRedirectsUpdated();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating redirect:', error);
    return NextResponse.json({ error: 'Failed to create redirect' }, { status: 500 });
  }
}
