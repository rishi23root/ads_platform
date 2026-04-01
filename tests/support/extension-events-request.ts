import { registerOrLoginExtensionEndUser } from './extension-register-or-login';
import type { ExtensionBearerSession } from './extension-ad-block-request';

export type ExtensionReportedEvent = {
  campaignId: string;
  domain: string;
  type: 'redirect' | 'notification';
};

/**
 * POST /api/extension/events. On 401, refreshes session and retries once.
 */
export async function postExtensionEvents(
  baseUrl: string,
  email: string,
  password: string,
  session: ExtensionBearerSession,
  body: { events: ExtensionReportedEvent[] },
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  const url = `${baseUrl}/api/extension/events`;
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
