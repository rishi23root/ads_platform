import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { database as db } from '@/db';
import { enduserEvents } from '@/db/schema';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import { ExtensionAdBlockError, geoCountryFromRequest } from '@/lib/extension-ad-block-handler';
import { fetchFrequencyCountsForEndUser } from '@/lib/extension-live-init';
import { publishFrequencyUpdated } from '@/lib/redis';
import { checkExtensionEventsRateLimit } from '@/lib/rate-limit';
import { computeExtensionDaysLeft } from '@/lib/extension-user-subscription';

export const dynamic = 'force-dynamic';

const eventItemSchema = z.object({
  campaignId: z.string().uuid(),
  domain: z.string().trim().min(1).max(255),
  type: z.enum(['redirect', 'notification']),
});

const bodySchema = z.object({
  events: z.array(eventItemSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const limited = await checkExtensionEventsRateLimit(request);
    if (limited) return limited;

    const resolved = await resolveEndUserFromRequest(request);
    if (!resolved) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endUser } = resolved;
    const daysLeft = computeExtensionDaysLeft({
      endDate: endUser.endDate,
      plan: endUser.plan,
      startDate: endUser.startDate,
    });
    if (daysLeft !== null && daysLeft <= 0) {
      throw new ExtensionAdBlockError('Access ended', 403, { error: 'trial_expired' });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const endUserIdStr = String(endUser.id);
    const emailVal = endUser.email?.trim() ? endUser.email.trim().slice(0, 255) : null;
    const geo = geoCountryFromRequest(request);
    const ua = request.headers.get('user-agent')?.trim().slice(0, 2000) ?? null;

    for (const ev of parsed.data.events) {
      await db.insert(enduserEvents).values({
        endUserId: endUserIdStr,
        email: emailVal,
        plan: endUser.plan,
        campaignId: ev.campaignId,
        domain: ev.domain.slice(0, 255),
        type: ev.type,
        country: geo,
        userAgent: ua,
      });
    }

    const distinctCampaignIds = [...new Set(parsed.data.events.map((e) => e.campaignId))];
    const counts = await fetchFrequencyCountsForEndUser(endUserIdStr, distinctCampaignIds);
    for (const campaignId of distinctCampaignIds) {
      await publishFrequencyUpdated({
        endUserId: endUserIdStr,
        campaignId,
        count: counts[campaignId] ?? 0,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ExtensionAdBlockError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[api/extension/events]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to record events', details: message },
      { status: 500 }
    );
  }
}
