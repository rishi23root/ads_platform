import {
  postExtensionWithBearerRetry,
  type ExtensionBearerSession,
} from './extension-authed-post';

export type { ExtensionBearerSession };

/**
 * POST /api/extension/ad-block. On 401, logs in again and retries once so shared test users stay valid when
 * parallel suites call login/register for the same end user.
 */
export async function postExtensionAdBlock(
  baseUrl: string,
  email: string,
  password: string,
  session: ExtensionBearerSession,
  body: unknown,
  extraHeaders: Record<string, string>
): Promise<Response> {
  return postExtensionWithBearerRetry(
    baseUrl,
    '/api/extension/ad-block',
    email,
    password,
    session,
    body,
    extraHeaders
  );
}
