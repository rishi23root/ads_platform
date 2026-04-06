import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { database as db } from '@/db';
import { enduserEvents } from '@/db/schema';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import {
  assertExtensionEndUserAccess,
  ExtensionAdBlockError,
  geoCountryFromRequest,
} from '@/lib/extension-ad-block-handler';
import { fetchFrequencyCountsForEndUser } from '@/lib/extension-live-init';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';
import { publishFrequencyUpdated } from '@/lib/redis';
import { checkExtensionEventsRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Single-object shape avoids discriminatedUnion edge cases across Zod minors; rules enforced in superRefine. */
const extensionEventItemSchema = z
  .object({
    type: z.enum(['visit', 'redirect', 'notification']),
    domain: z.string().trim().min(1).max(255),
    campaignId: z.string().uuid().optional(),
    /** Optional client navigation time (ISO 8601). Safe to omit; not persisted to a dedicated column yet. */
    visitedAt: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'visit') {
      if (data.campaignId != null) {
        ctx.addIssue({
          code: 'custom',
          path: ['campaignId'],
          message: 'omit campaignId for type visit',
        });
      }
      return;
    }
    if (data.campaignId == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['campaignId'],
        message: 'campaignId is required for redirect and notification',
      });
    }
    if (data.visitedAt != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['visitedAt'],
        message: 'visitedAt is only valid for type visit',
      });
    }
  });

const bodySchema = z.object({
  events: z.array(extensionEventItemSchema).min(1).max(50),
});

/**
 * POST /api/extension/events — batched visit / notification / redirect telemetry (max 50 items).
 *
 * Input: `Authorization: Bearer <token>`. JSON `{ events: [{ type, domain, campaignId?, visitedAt? }, ...] }` per `bodySchema`.
 *
 * Output: `200` `{ ok: true }` | `400`|`401` JSON errors | `500` on failure; may return `ExtensionAdBlockError` body/status.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await checkExtensionEventsRateLimit(request);
    if (limited) return limited;

    const resolved = await resolveEndUserFromRequest(request);
    if (!resolved) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endUser } = resolved;
    assertExtensionEndUserAccess(endUser);

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
    const userIdent = userIdentifierForEndUser(endUser);
    const geo = geoCountryFromRequest(request);
    const ua = request.headers.get('user-agent')?.trim().slice(0, 2000) ?? null;

    for (const ev of parsed.data.events) {
      await db.insert(enduserEvents).values({
        userIdentifier: userIdent,
        campaignId: ev.type === 'visit' ? null : (ev.campaignId ?? null),
        domain: ev.domain.slice(0, 255),
        type: ev.type,
        country: geo,
        userAgent: ua,
      });
    }

    const distinctCampaignIds = [
      ...new Set(
        parsed.data.events
          .filter((e) => e.type === 'redirect' || e.type === 'notification')
          .map((e) => e.campaignId)
          .filter((id): id is string => id != null && id.length > 0)
      ),
    ];
    const counts = await fetchFrequencyCountsForEndUser(userIdent, distinctCampaignIds);
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
