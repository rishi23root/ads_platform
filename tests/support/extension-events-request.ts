import {
  postExtensionWithBearerRetry,
  type ExtensionBearerSession,
} from './extension-authed-post';

export type { ExtensionBearerSession };

export type ExtensionReportedEvent =
  | { type: 'visit'; domain: string; visitedAt?: string }
  | { type: 'redirect'; campaignId: string; domain: string };

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
  return postExtensionWithBearerRetry(
    baseUrl,
    '/api/extension/events',
    email,
    password,
    session,
    body,
    extraHeaders
  );
}
