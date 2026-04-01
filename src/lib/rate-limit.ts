import { NextRequest } from 'next/server';
import { getRedisClient } from './redis';

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

const AD_BLOCK_LIMIT = 120; // per minute per IP
const AD_BLOCK_WINDOW_SEC = 60;

async function checkExtensionRatelimit(
  request: NextRequest,
  bucket: string
): Promise<Response | null> {
  const client = await getRedisClient();
  if (!client) return null;

  const ip = getClientIp(request);
  const key = `ratelimit:ext:${bucket}:${ip}`;

  try {
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, AD_BLOCK_WINDOW_SEC);
    }
    if (count > AD_BLOCK_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check rate limit for extension ad-block. Returns null if allowed, or Response with 429 if exceeded.
 * If Redis is unavailable, returns null (allow) — enable REDIS_URL in production for abuse protection.
 */
export async function checkAdBlockRateLimit(
  request: NextRequest
): Promise<Response | null> {
  return checkExtensionRatelimit(request, 'ad-block');
}

export async function checkServeAdsRateLimit(request: NextRequest): Promise<Response | null> {
  return checkExtensionRatelimit(request, 'serve-ads');
}

export async function checkExtensionEventsRateLimit(request: NextRequest): Promise<Response | null> {
  return checkExtensionRatelimit(request, 'events');
}
