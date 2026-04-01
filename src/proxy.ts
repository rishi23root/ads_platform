/**
 * Next.js 16+ edge entry: the `proxy` file convention replaces `middleware`.
 * See https://nextjs.org/docs/app/api-reference/file-conventions/proxy — do not add `middleware.ts`.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  void request;
  const res = NextResponse.next();
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
