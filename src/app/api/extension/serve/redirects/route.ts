import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import { ExtensionAdBlockError } from '@/lib/extension-ad-block-handler';
import { runServeRedirects } from '@/lib/extension-serve-handlers';
import { checkServeRedirectsRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  /** Optional: narrow to campaigns tied to platforms matching this hostname. Omit for all eligible redirect campaigns. */
  domain: z.string().trim().min(1).max(255).optional(),
});

/**
 * POST /api/extension/serve/redirects — all redirect campaigns that pass schedule, frequency/count, geo, and audience (same qualifiers as serve/ads).
 *
 * Does **not** insert `enduser_events`. After the client navigates, report with `POST /api/extension/events` (`type: "redirect"`).
 *
 * Input: `Authorization: Bearer <token>`. JSON `{ domain? }`.
 *
 * Output: `200` `{ redirects: [{ campaignId, domain_regex, target_url, date_till, count }] }` | `400`|`401` | `500`.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await checkServeRedirectsRateLimit(request);
    if (limited) return limited;

    const resolved = await resolveEndUserFromRequest(request);
    if (!resolved) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await runServeRedirects({
      endUser: resolved.endUser,
      request,
      domain: parsed.data.domain,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExtensionAdBlockError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[api/extension/serve/redirects]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load redirects', details: message },
      { status: 500 }
    );
  }
}
