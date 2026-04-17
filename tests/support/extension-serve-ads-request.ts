import {
  postExtensionWithBearerRetry,
  type ExtensionBearerSession,
} from './extension-authed-post';

export type { ExtensionBearerSession };

export type ExtensionServeBody = {
  domain: string;
  type?: 'ads' | 'popup' | 'notification';
};

/**
 * POST /api/extension/serve. On 401, refreshes session and retries once.
 */
export async function postExtensionServe(
  baseUrl: string,
  email: string,
  password: string,
  session: ExtensionBearerSession,
  body: ExtensionServeBody,
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  return postExtensionWithBearerRetry(
    baseUrl,
    '/api/extension/serve',
    email,
    password,
    session,
    body,
    extraHeaders
  );
}
