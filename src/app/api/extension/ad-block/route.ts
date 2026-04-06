import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import {
  ExtensionAdBlockError,
  runExtensionAdBlock,
} from '@/lib/extension-ad-block-handler';
import { checkAdBlockRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    domain: z.string().trim().max(255).optional(),
    requestType: z.enum(['ad', 'notification']).optional(),
    userAgent: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestType !== 'notification' && !data.domain?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'domain is required unless requestType is "notification"',
        path: ['domain'],
      });
    }
  });

/**
 * POST /api/extension/ad-block — legacy hydrated ads/notifications/redirects for a visit.
 *
 * Input: `Authorization: Bearer <token>`. JSON `{ domain?, requestType?: "ad"|"notification", userAgent? }` — `domain` required unless `requestType` is `notification`.
 *
 * Output: `200` `{ ads, notifications, redirects }` | `400`|`401` JSON errors | `500` on failure; may return handler-specific status/body (`ExtensionAdBlockError`).
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await checkAdBlockRateLimit(request);
    if (limited) return limited;

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

    const domain = parsed.data.domain?.trim() || undefined;
    const requestType = parsed.data.requestType;
    const ua =
      parsed.data.userAgent?.trim().slice(0, 2000) ||
      request.headers.get('user-agent')?.trim().slice(0, 2000) ||
      null;

    const result = await runExtensionAdBlock({
      endUser: resolved.endUser,
      request,
      domain,
      requestType,
      userAgent: ua,
    });

    return NextResponse.json({
      ads: result.ads,
      notifications: result.notifications,
      redirects: result.redirects,
    });
  } catch (error) {
    if (error instanceof ExtensionAdBlockError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[api/extension/ad-block]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load ad block payload', details: message },
      { status: 500 }
    );
  }
}
