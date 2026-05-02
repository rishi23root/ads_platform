import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';

/**
 * Shared JSON body parser for API routes.
 *
 * Enforces `Content-Type: application/json` (RFC 7231 → 415 Unsupported Media Type on mismatch),
 * parses the body, and validates it against the given Zod schema. Returns typed data on success
 * or a ready-to-return `NextResponse` on failure, with consistent error shapes across endpoints.
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      ),
    };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
