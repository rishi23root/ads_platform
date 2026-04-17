import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { database as db } from '@/db';
import { campaigns, enduserEvents } from '@/db/schema';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import { userIdentifierForEndUser } from '@/lib/enduser-merge';
import { countryCodeFromRequestHeaders } from '@/lib/enduser-request-country';

export const dynamic = 'force-dynamic';

/** Maximum number of events accepted per request. Extension targets ≤10; cap is a safety guard. */
const MAX_EVENTS = 100;

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
 * Output: `200` `{ ok: true, inserted: n }` | `400` | `401` | `500`.
 */
export async function POST(request: NextRequest) {
  const resolved = await resolveEndUserFromRequest(request);
  if (!resolved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const { endUser } = resolved;
  const userIdentifier = userIdentifierForEndUser(endUser);
  const country = countryCodeFromRequestHeaders(request) ?? endUser.country ?? null;
  const userAgent = request.headers.get('user-agent')?.slice(0, 2000) ?? null;
  const events = parsed.data.events;

  // Validate campaign IDs for redirect events to ensure they exist and are redirect campaigns.
  const campaignEventIds = events
    .filter((e) => e.type === 'redirect')
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
  const skipped: string[] = [];

  for (const ev of events) {
    if (ev.type === 'visit') {
      const createdAt = ev.visitedAt ? new Date(ev.visitedAt) : undefined;
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
      skipped.push(campaignId);
      continue;
    }

    const dbType = campaignTypeById.get(campaignId);
    if (dbType !== 'redirect') {
      skipped.push(campaignId);
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

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: skipped.length });
  }

  await db.insert(enduserEvents).values(rows);

  return NextResponse.json({ ok: true, inserted: rows.length, skipped: skipped.length });
}
