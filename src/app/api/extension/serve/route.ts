import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import { ExtensionAdBlockError } from '@/lib/extension-ad-block-handler';
import {
  logExtensionServeEvents,
  runServeCreatives,
  type ExtensionServeCreativeType,
} from '@/lib/extension-serve-handlers';

export const dynamic = 'force-dynamic';

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
 * Input: `Authorization: Bearer <token>`. JSON `{ domain, type? }`. User-Agent is taken only from the `User-Agent` request header (do not send it in the body).
 *
 * Output: `200` `{ ads, popups, notifications }` — each item is `id` + `ad` or `id` + `notification` only (targeting applied server-side). `400`|`401` JSON errors | `500` on failure; may return `ExtensionAdBlockError` body/status.
 */
export async function POST(request: NextRequest) {
  try {
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

    const campaignTypes = parsed.data.type
      ? [parsed.data.type]
      : DEFAULT_CREATIVE_TYPES;

    const result = await runServeCreatives({
      endUser: resolved.endUser,
      request,
      domain: parsed.data.domain,
      campaignTypes,
    });

    await logExtensionServeEvents({
      endUser: resolved.endUser,
      request,
      domain: parsed.data.domain,
      ads: result.ads,
      popups: result.popups,
      notifications: result.notifications,
    });

    return NextResponse.json({
      ads: result.ads,
      popups: result.popups,
      notifications: result.notifications,
    });
  } catch (error) {
    if (error instanceof ExtensionAdBlockError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[api/extension/serve]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load creatives', details: message },
      { status: 500 }
    );
  }
}
