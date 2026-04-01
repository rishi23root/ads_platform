import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { campaignRowNotSoftDeleted } from '@/lib/campaign-soft-delete-sql';
import { getSessionWithRole } from '@/lib/dal';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET campaigns linked to this notification
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: notificationId } = await context.params;

    const linkedCampaigns = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        campaignType: campaigns.campaignType,
        status: campaigns.status,
      })
      .from(campaigns)
      .where(and(eq(campaigns.notificationId, notificationId), campaignRowNotSoftDeleted))
      .orderBy(campaigns.name);

    return NextResponse.json(linkedCampaigns);
  } catch (error) {
    console.error('Error fetching notification campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
