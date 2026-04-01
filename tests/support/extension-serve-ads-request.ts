import { registerOrLoginExtensionEndUser } from './extension-register-or-login';
import type { ExtensionBearerSession } from './extension-ad-block-request';

/**
 * POST /api/extension/serve/ads. On 401, refreshes session and retries once.
 */
export async function postExtensionServeAds(
  baseUrl: string,
  email: string,
  password: string,
  session: ExtensionBearerSession,
  body: { domain: string; userAgent?: string },
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  const url = `${baseUrl}/api/extension/serve/ads`;
  const buildInit = (token: string): RequestInit => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  let res = await fetch(url, buildInit(session.token));
  if (res.status === 401) {
    const fresh = await registerOrLoginExtensionEndUser(baseUrl, email, password);
    session.token = fresh.token;
    res = await fetch(url, buildInit(session.token));
  }
  return res;
}
