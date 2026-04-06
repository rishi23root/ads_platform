import { NextRequest, NextResponse } from 'next/server';
import { endUserPublicPayload, resolveEndUserFromRequest } from '@/lib/enduser-auth';

/**
 * GET /api/extension/auth/me — current end user from Bearer token.
 *
 * Input: `Authorization: Bearer <token>`.
 *
 * Output: `200` `{ user }` (public end-user fields) | `401` `{ error: "Unauthorized" }`.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveEndUserFromRequest(request);
  if (!resolved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ user: endUserPublicPayload(resolved.endUser) });
}
