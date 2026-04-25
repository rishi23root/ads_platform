import type { NextRequest } from 'next/server';

/**
 * Parse `?limit=` and `?offset=` from the request URL with safe defaults and caps.
 * Backwards-compatible: when the caller omits both params, we still apply a safety `limit`
 * so a forgotten query doesn't enumerate an unbounded table.
 */
export function parsePagination(
  request: NextRequest | Request,
  options?: { defaultLimit?: number; maxLimit?: number }
): { limit: number; offset: number } {
  const defaultLimit = options?.defaultLimit ?? 500;
  const maxLimit = options?.maxLimit ?? 1000;
  const { searchParams } = new URL(request.url);

  const rawLimit = searchParams.get('limit');
  const rawOffset = searchParams.get('offset');

  const parsedLimit = rawLimit !== null ? parseInt(rawLimit, 10) : defaultLimit;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, maxLimit)
    : defaultLimit;

  const parsedOffset = rawOffset !== null ? parseInt(rawOffset, 10) : 0;
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  return { limit, offset };
}
