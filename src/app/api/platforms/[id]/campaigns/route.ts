import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { and, arrayContains, ne } from 'drizzle-orm';
import { getSessionWithRole } from '@/lib/dal';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET campaigns that target this platform (platform id in campaign.platform_ids)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: platformId } = await context.params;

    const linkedCampaigns = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        campaignType: campaigns.campaignType,
        status: campaigns.status,
      })
      .from(campaigns)
      .where(and(arrayContains(campaigns.platformIds, [platformId]), ne(campaigns.status, 'deleted')))
      .orderBy(campaigns.name);

    return NextResponse.json(linkedCampaigns);
  } catch (error) {
    console.error('Error fetching platform campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
