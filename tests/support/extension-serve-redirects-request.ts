import {
  postExtensionWithBearerRetry,
  type ExtensionBearerSession,
} from './extension-authed-post';

export type { ExtensionBearerSession };

/**
 * POST /api/extension/serve/redirects. On 401, refreshes session and retries once.
 */
export async function postExtensionServeRedirects(
  baseUrl: string,
  email: string,
  password: string,
  session: ExtensionBearerSession,
  body: { domain?: string } = {},
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  return postExtensionWithBearerRetry(
    baseUrl,
    '/api/extension/serve/redirects',
    email,
    password,
    session,
    body,
    extraHeaders
  );
}
