import { registerOrLoginExtensionEndUser } from './extension-register-or-login';

/** Mutable bearer; updated if login invalidates the previous session (single-session policy). */
export type ExtensionBearerSession = { token: string };

/**
 * POST to an extension API path with Bearer auth; on 401, re-login once and retry.
 */
export async function postExtensionWithBearerRetry(
  baseUrl: string,
  path: string,
  email: string,
  password: string,
  session: ExtensionBearerSession,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  const url = `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
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
