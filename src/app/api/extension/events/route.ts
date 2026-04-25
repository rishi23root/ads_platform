import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { database as db } from '@/db';
import { campaigns, enduserEvents } from '@/db/schema';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';
import { countryCodeFromRequestHeaders } from '@/lib/enduser-request-country';
import { parseJsonBody } from '@/lib/parse-json-request';
import { logger } from '@/lib/logger';
import {
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Maximum number of events accepted per request. Extension targets ≤10; cap is a safety guard. */
const MAX_EVENTS = 100;

/** Events batch at ≤10 per request, ~60 s cadence. 120 batches/min/user (= 1200 events/min) is
 * well above normal while still stopping a rogue client from mass-inserting visits. */
const EVENTS_RATE = { name: 'ext-events', limit: 120, windowSec: 60 } as const;

/** Clock-skew tolerance for client-supplied `visitedAt` timestamps. */
const VISITED_AT_MAX_PAST_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VISITED_AT_MAX_FUTURE_MS = 24 * 60 * 60 * 1000; // 1 day

const visitEventSchema = z.object({
  type: z.literal('visit'),
  domain: z.string().trim().min(1).max(255),
  /**
   * ISO 8601 timestamp for when the visit occurred (extension-side). When omitted, the server
   * uses the current time. Allows the extension to flush queued events with accurate timestamps.
   */
  visitedAt: z.string().datetime().optional(),
});

const redirectEventSchema = z.object({
  type: z.literal('redirect'),
  campaignId: z.string().uuid(),
  domain: z.string().trim().min(1).max(255),
});

const eventSchema = z.discriminatedUnion('type', [visitEventSchema, redirectEventSchema]);

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(MAX_EVENTS),
});

/**
 * POST /api/extension/events — batch-insert user-reported events.
 *
 * Input: `Authorization: Bearer <token>`. JSON `{ events: [...] }`.
 *
 * Event types:
 * - `visit`:    `{ type, domain, visitedAt? }` — page visit; no campaign required.
 * - `redirect`: `{ type, campaignId, domain }` — extension performed a redirect.
 *
 * Notification impressions are not accepted here; they are recorded when creatives are returned
 * from `POST /api/extension/serve`.
 *
 * The extension should flush its local queue when it reaches ≥10 events or ~60 s since
 * the oldest queued event — whichever comes first.
 *
 * Output: `200` `{ ok: true, inserted, skipped }` | `400` | `401` | `415` | `500`.
 */
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveEndUserFromRequest(request);
    if (!resolved) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await consumeRateLimit(resolved.endUser.id, EVENTS_RATE);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) return body.response;

    const { endUser } = resolved;
    const userIdentifier = userIdentifierForEndUser(endUser);
    const country = countryCodeFromRequestHeaders(request) ?? endUser.country ?? null;
    const userAgent = request.headers.get('user-agent')?.slice(0, 2000) ?? null;
    const events = body.data.events;

    const campaignEventIds = events
      .filter((e): e is z.infer<typeof redirectEventSchema> => e.type === 'redirect')
      .map((e) => e.campaignId);

    const validCampaignIds = new Set<string>();
    const campaignTypeById = new Map<string, string>();

    if (campaignEventIds.length > 0) {
      const uniqueIds = [...new Set(campaignEventIds)];
      const rows = await db
        .select({ id: campaigns.id, campaignType: campaigns.campaignType })
        .from(campaigns)
        .where(and(inArray(campaigns.id, uniqueIds), eq(campaigns.status, 'active')));

      for (const r of rows) {
        validCampaignIds.add(r.id);
        campaignTypeById.set(r.id, r.campaignType);
      }
    }

    const rows: (typeof enduserEvents.$inferInsert)[] = [];
    // Deduped by campaignId to avoid counting the same invalid id N times per batch.
    const skippedUnknown = new Set<string>();
    const skippedWrongType = new Set<string>();

    const now = Date.now();

    for (const ev of events) {
      if (ev.type === 'visit') {
        let createdAt: Date | undefined;
        if (ev.visitedAt) {
          const parsed = new Date(ev.visitedAt);
          const t = parsed.getTime();
          if (!Number.isFinite(t)) {
            // Zod already validates ISO 8601 format, but be defensive.
            continue;
          }
          if (t < now - VISITED_AT_MAX_PAST_MS || t > now + VISITED_AT_MAX_FUTURE_MS) {
            // Clock-skew / replay guard: clamp to server time instead of rejecting
            // the batch, so a drifting client still reports events.
            createdAt = new Date(now);
          } else {
            createdAt = parsed;
          }
        }
        rows.push({
          userIdentifier,
          campaignId: null,
          domain: ev.domain,
          type: 'visit',
          country,
          userAgent,
          ...(createdAt ? { createdAt } : {}),
        });
        continue;
      }

      const { campaignId, domain, type } = ev;

      if (!validCampaignIds.has(campaignId)) {
        skippedUnknown.add(campaignId);
        continue;
      }

      const dbType = campaignTypeById.get(campaignId);
      if (dbType !== 'redirect') {
        skippedWrongType.add(campaignId);
        continue;
      }

      rows.push({
        userIdentifier,
        campaignId,
        domain,
        type,
        country,
        userAgent,
      });
    }

    const skipped = skippedUnknown.size + skippedWrongType.size;

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, skipped });
    }

    await db.insert(enduserEvents).values(rows);

    return NextResponse.json({ ok: true, inserted: rows.length, skipped });
  } catch (error) {
    logger.error('[api/extension/events] failed', error);
    return NextResponse.json({ error: 'Failed to record events' }, { status: 500 });
  }
}
