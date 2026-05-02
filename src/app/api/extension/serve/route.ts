import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import {
  logExtensionServeEvents,
  runServeCreatives,
  type ExtensionServeCreativeType,
} from '@/lib/extension-serve-handlers';
import { parseJsonBody } from '@/lib/parse-json-request';
import { logger } from '@/lib/logger';
import {
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Serve is the extension's hot path. 300/min per end-user ≈ 5 req/s — well above any normal
 * browsing cadence (extensions call per navigation) but low enough to throttle obvious abuse. */
const SERVE_RATE = { name: 'ext-serve', limit: 300, windowSec: 60 } as const;

const DEFAULT_CREATIVE_TYPES: ExtensionServeCreativeType[] = ['ads', 'popup', 'notification'];

const bodySchema = z
  .object({
    domain: z.string().trim().min(1).max(255),
    type: z.enum(['ads', 'popup', 'notification']).optional(),
  })
  .strict();

/**
 * POST /api/extension/serve — per-visit creatives (inline ads, popups, notifications).
 * Optional `type` filters to one campaign kind; omit `type` to return all three.
 * Redirect rules are delivered only via SSE (`init.redirects`, `redirects_updated`, `campaign_updated`).
 *
 * Input: `Authorization: Bearer <token>`. `Content-Type: application/json`. JSON `{ domain, type? }`.
 * User-Agent is taken only from the `User-Agent` request header (do not send it in the body).
 *
 * Output: `200` `{ ads, popups, notifications }` — each item is `id` + `ad` or `id` + `notification`
 * only (targeting applied server-side). `400`|`401`|`415` JSON errors | `500` on failure.
 */
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveEndUserFromRequest(request);
    if (!resolved) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await consumeRateLimit(resolved.endUser.id, SERVE_RATE);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) return body.response;

    const campaignTypes = body.data.type
      ? [body.data.type]
      : DEFAULT_CREATIVE_TYPES;

    const result = await runServeCreatives({
      endUser: resolved.endUser,
      request,
      domain: body.data.domain,
      campaignTypes,
    });

    // Defer serve-event logging so it doesn't add to response latency.
    // `after()` runs post-response within the same server invocation (Next.js 15+).
    // The request-derived values are captured now so `request` isn't touched after response.
    const logParams = {
      endUser: resolved.endUser,
      request,
      domain: body.data.domain,
      ads: result.ads,
      popups: result.popups,
      notifications: result.notifications,
    };
    after(async () => {
      try {
        await logExtensionServeEvents(logParams);
      } catch (err) {
        logger.error('[api/extension/serve] logExtensionServeEvents failed', err);
      }
    });

    return NextResponse.json({
      ads: result.ads,
      popups: result.popups,
      notifications: result.notifications,
    });
  } catch (error) {
    logger.error('[api/extension/serve] failed', error);
    const body: Record<string, unknown> = { error: 'Failed to load creatives' };
    if (process.env.NODE_ENV !== 'production') {
      body.details = error instanceof Error ? error.message : String(error);
    }
    return NextResponse.json(body, { status: 500 });
  }
}
