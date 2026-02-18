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
const LIVE_LIMIT = 10; // connections per minute per IP (for SSE)
const LIVE_WINDOW_SEC = 60;

/**
 * Check rate limit for extension ad-block. Returns null if allowed, or Response with 429 if exceeded.
 */
export async function checkAdBlockRateLimit(
  request: NextRequest
): Promise<Response | null> {
  const client = await getRedisClient();
  if (!client) return null; // no Redis = no rate limit (graceful degradation)

  const ip = getClientIp(request);
  const key = `ratelimit:ad-block:${ip}`;

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
    return null; // on Redis error, allow request
  }
}

/**
 * Check rate limit for extension live SSE. Returns null if allowed, or Response with 429 if exceeded.
 */
export async function checkLiveRateLimit(
  request: NextRequest
): Promise<Response | null> {
  const client = await getRedisClient();
  if (!client) return null;

  const ip = getClientIp(request);
  const key = `ratelimit:live:${ip}`;

  try {
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, LIVE_WINDOW_SEC);
    }
    if (count > LIVE_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Too many connections. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return null;
  } catch {
    return null;
  }
}
