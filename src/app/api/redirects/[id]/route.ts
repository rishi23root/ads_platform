import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { redirects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeDomainForRedirectStorage } from '@/lib/domain-utils';
import { getSessionWithRole } from '@/lib/dal';
import { queryPlatformConflictForRedirect } from '@/lib/redirect-platform-conflict-queries';
import { getLinkedCampaignCountForRedirectId } from '@/lib/campaign-linked-counts';
import { publishRedirectsUpdated } from '@/lib/redis';
import { publishCampaignUpdatedForLinkedRedirect } from '@/lib/campaign-linked-counts';
// NOTE: On a redirect UPDATE we publish ONLY `redirects_updated`. The SSE handler
// for that event already rebuilds this user's full qualifying redirect list, so
// also firing `campaign_updated` for a linked campaign would deliver the same data
// twice. `publishCampaignUpdatedForLinkedRedirect` is kept for DELETE, where the
// linked campaign's effective redirect reference disappears and we want extensions
// to invalidate any per-campaign caches beyond just the redirect rules.

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const [row] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Redirect not found' }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (error) {
    console.error('Error fetching redirect:', error);
    return NextResponse.json({ error: 'Failed to fetch redirect' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
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

    const [updated] = await db
      .update(redirects)
      .set({
        name,
        sourceDomain: normalizedSource,
        includeSubdomains: includeSub,
        destinationUrl: String(destinationUrl).trim(),
        updatedAt: new Date(),
      })
      .where(eq(redirects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Redirect not found' }, { status: 404 });
    }

    // Single event per UI update action. `redirects_updated` is a strict superset
    // of what a linked `campaign_updated` would contribute here (the redirect list
    // for this user is rebuilt on the extension side), so we do not double-publish.
    await publishRedirectsUpdated();
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating redirect:', error);
    return NextResponse.json({ error: 'Failed to update redirect' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionWithRole.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const linked = await getLinkedCampaignCountForRedirectId(id);
    if (linked > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this redirect while it is used by ${linked} campaign(s). Unlink or remove those campaigns first.`,
        },
        { status: 409 }
      );
    }

    const [deleted] = await db.delete(redirects).where(eq(redirects.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Redirect not found' }, { status: 404 });
    }

    await publishCampaignUpdatedForLinkedRedirect(id);
    await publishRedirectsUpdated();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting redirect:', error);
    return NextResponse.json({ error: 'Failed to delete redirect' }, { status: 500 });
  }
}
