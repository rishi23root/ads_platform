import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import { ExtensionAdBlockError } from '@/lib/extension-ad-block-handler';
import { runServeAds } from '@/lib/extension-serve-handlers';
import { checkServeAdsRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  domain: z.string().trim().min(1).max(255),
  userAgent: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const limited = await checkServeAdsRateLimit(request);
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

    const ua =
      parsed.data.userAgent?.trim().slice(0, 2000) ||
      request.headers.get('user-agent')?.trim().slice(0, 2000) ||
      null;

    const result = await runServeAds({
      endUser: resolved.endUser,
      request,
      domain: parsed.data.domain,
      userAgent: ua,
    });

    return NextResponse.json({
      ads: result.ads,
      redirects: result.redirects ?? [],
    });
  } catch (error) {
    if (error instanceof ExtensionAdBlockError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[api/extension/serve/ads]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load ads', details: message },
      { status: 500 }
    );
  }
}
