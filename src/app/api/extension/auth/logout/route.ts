import { NextRequest, NextResponse } from 'next/server';
import { deleteEnduserSessionByToken, getBearerFromRequest } from '@/lib/enduser-auth';

/**
 * POST /api/extension/auth/logout — invalidate the current Bearer session.
 *
 * Input: `Authorization: Bearer <token>`. Body ignored.
 *
 * Output: `200` `{ ok: true }` | `401` `{ error: "Authorization Bearer token required" }`.
 */
export async function POST(request: NextRequest) {
  const token = getBearerFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'Authorization Bearer token required' }, { status: 401 });
  }
  await deleteEnduserSessionByToken(token);
  return NextResponse.json({ ok: true });
}
