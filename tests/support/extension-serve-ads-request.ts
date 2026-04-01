import {
  postExtensionWithBearerRetry,
  type ExtensionBearerSession,
} from './extension-authed-post';

export type { ExtensionBearerSession };

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
  return postExtensionWithBearerRetry(
    baseUrl,
    '/api/extension/serve/ads',
    email,
    password,
    session,
    body,
    extraHeaders
  );
}
