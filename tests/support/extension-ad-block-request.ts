import { registerOrLoginExtensionEndUser } from './extension-register-or-login';

/** Mutable bearer; updated if another login invalidates the previous session (single-session policy in createEnduserSession). */
export type ExtensionBearerSession = { token: string };

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
  const url = `${baseUrl}/api/extension/ad-block`;
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
