import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Fixed-window rate limiter with Redis `INCR` + `EXPIRE NX`. If Redis is unavailable,
 * falls back to an in-process LRU-ish Map so single-instance deployments still get protection.
 *
 * For the extension traffic shape (many short requests from fixed clients), a fixed window
 * keeps book-keeping to one `INCR` per request and remains predictable under burst load.
 */

export type RateLimitResult =
  | { allowed: true; remaining: number; limit: number; resetAt: number }
  | { allowed: false; remaining: 0; limit: number; resetAt: number; retryAfterSec: number };

export type RateLimitOptions = {
  /** Human-readable scope (used as Redis key prefix). */
  name: string;
  /** Max requests per window. */
  limit: number;
  /** Window size in seconds. */
  windowSec: number;
};

const MAX_LOCAL_ENTRIES = 10_000;
type LocalEntry = { count: number; resetAt: number };
const localBuckets = new Map<string, LocalEntry>();

function evictLocalIfFull() {
  if (localBuckets.size <= MAX_LOCAL_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of localBuckets) {
    if (v.resetAt <= now) localBuckets.delete(k);
  }
  if (localBuckets.size > MAX_LOCAL_ENTRIES) {
    // Drop oldest (insertion order) until under cap.
    const excess = localBuckets.size - MAX_LOCAL_ENTRIES;
    let i = 0;
    for (const k of localBuckets.keys()) {
      if (i++ >= excess) break;
      localBuckets.delete(k);
    }
  }
}

function localConsume(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = localBuckets.get(key);
  const windowMs = opts.windowSec * 1000;
  if (!entry || entry.resetAt <= now) {
    const next: LocalEntry = { count: 1, resetAt: now + windowMs };
    localBuckets.set(key, next);
    evictLocalIfFull();
    return {
      allowed: true,
      remaining: opts.limit - 1,
      limit: opts.limit,
      resetAt: next.resetAt,
    };
  }
  entry.count += 1;
  if (entry.count > opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      limit: opts.limit,
      resetAt: entry.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return {
    allowed: true,
    remaining: opts.limit - entry.count,
    limit: opts.limit,
    resetAt: entry.resetAt,
  };
}

/**
 * Consume one token against the key. Identity is caller-controlled so you can key on
 * `ip`, `endUserId`, or `route + ip + userId`.
 */
export async function consumeRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const fullKey = `rl:${opts.name}:${key}`;
  const client = await getRedisClient();
  if (!client) return localConsume(fullKey, opts);

  try {
    const count = await client.incr(fullKey);
    // First request in the window — set TTL.
    if (count === 1) {
      await client.expire(fullKey, opts.windowSec);
    }
    const ttl = await client.ttl(fullKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : opts.windowSec * 1000);
    if (count > opts.limit) {
      return {
        allowed: false,
        remaining: 0,
        limit: opts.limit,
        resetAt,
        retryAfterSec: Math.max(1, ttl > 0 ? ttl : opts.windowSec),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, opts.limit - count),
      limit: opts.limit,
      resetAt,
    };
  } catch (err) {
    logger.warn('[rate-limit] redis error, falling back to local', {
      error: err instanceof Error ? err.message : String(err),
    });
    return localConsume(fullKey, opts);
  }
}

export function clientIpFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim().slice(0, 64);
  return 'unknown';
}

/** Build a standard 429 response with rate-limit headers. */
export function rateLimitResponse(result: Extract<RateLimitResult, { allowed: false }>) {
  const res = NextResponse.json(
    { error: 'Too many requests' },
    { status: 429 }
  );
  res.headers.set('Retry-After', String(result.retryAfterSec));
  res.headers.set('X-RateLimit-Limit', String(result.limit));
  res.headers.set('X-RateLimit-Remaining', '0');
  res.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));
  return res;
}

/** Set rate-limit headers on a successful response (optional but useful for debugging). */
export function applyRateLimitHeaders(
  res: NextResponse,
  result: Extract<RateLimitResult, { allowed: true }>
) {
  res.headers.set('X-RateLimit-Limit', String(result.limit));
  res.headers.set('X-RateLimit-Remaining', String(result.remaining));
  res.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));
  return res;
}

/**
 * Redact bearer tokens and emails from an arbitrary string so it's safe to log.
 * Used by routes that may otherwise surface credentials in error metadata.
 */
export function scrubSensitive(input: string): string {
  return input
    .replace(/(token=)[^\s&]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)\S+/gi, '$1[REDACTED]')
    .replace(/([a-zA-Z0-9._%+-]{1,64})@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (_m, a: string, b: string) => {
      const head = a.slice(0, 1);
      return `${head}***@${b}`;
    });
}

/** Hash-ish truncation for logging emails without storing them verbatim. */
export function maskEmailForLog(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***@${email.slice(at + 1)}`;
}
