/**
 * Next.js 16+ edge entry: the `proxy` file convention replaces `middleware`.
 * See https://nextjs.org/docs/app/api-reference/file-conventions/proxy — do not add `middleware.ts`.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const EXTENSION_API_PREFIX = '/api/extension/';

/**
 * CORS for the extension-facing API. These endpoints are Bearer-authenticated (no cookies),
 * so a permissive `Access-Control-Allow-Origin: *` is safe — we do NOT set `Allow-Credentials`.
 */
function isExtensionApi(pathname: string): boolean {
  return pathname.startsWith(EXTENSION_API_PREFIX);
}

function setExtensionCorsHeaders(res: NextResponse, request: NextRequest) {
  // Mirror the request origin when present so browsers accept the response; fall back to `*`
  // for non-browser clients (curl, extension service workers in some runtimes).
  const origin = request.headers.get('origin') ?? '*';
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Vary', 'Origin');
  res.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept'
  );
  res.headers.set('Access-Control-Max-Age', '86400');
}

function setSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Conservative CSP for the admin dashboard. Tighten iteratively as we identify
    // first-party-only assets; 'unsafe-inline' is retained for now because Next.js still
    // emits inline bootstrap scripts without a nonce integration.
    res.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isExt = isExtensionApi(pathname);

  // Short-circuit CORS preflight so it never hits route handlers.
  if (isExt && request.method === 'OPTIONS') {
    const pre = new NextResponse(null, { status: 204 });
    setExtensionCorsHeaders(pre, request);
    return pre;
  }

  const res = NextResponse.next();
  setSecurityHeaders(res);
  if (isExt) setExtensionCorsHeaders(res, request);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
