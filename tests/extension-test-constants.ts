/**
 * Stable extension end-user emails for integration tests.
 * Each address maps to one scenario so DB rows and support logs are easy to identify.
 *
 * All use the same password; tests call ensureExtensionUser() which logs in if the user
 * already exists, or registers on first run.
 *
 * Domain example.test is reserved for documentation / testing (RFC 2606).
 */
export const EXTENSION_INTEGRATION_PASSWORD = 'ExtensionTest!Auth99';

export const EXTENSION_TEST_EMAIL = {
  /** 01 — Auth: session (me), logout, then 401 on token */
  authLifecycle: 'extension.test.01-auth-lifecycle@example.test',
  /** 02 — SSE init payload with Bearer (user + campaigns + frequencyCounts) */
  sseInitAuthenticated: 'extension.test.02-sse-init-authenticated@example.test',
  /** 03 — SSE listener while admin triggers campaign_updated */
  sseCampaignUpdatedListener: 'extension.test.03-sse-campaign-updated-listener@example.test',
  /** 04 — POST /api/extension/sync visit batch + frequencyCounts */
  batchSyncVisits: 'extension.test.04-batch-sync-visits@example.test',
  /** 05 — Ad-block: ads / notifications / redirects array shapes */
  adBlockFallbackShapes: 'extension.test.05-ad-block-fallback-shapes@example.test',
  /** 06 — Ad-block: notification-only, no domain */
  adBlockNotificationOnly: 'extension.test.06-ad-block-notification-only@example.test',
  /** 07 — End-to-end: SSE init → sync → ad-block → logout */
  fullLifecycle: 'extension.test.07-full-lifecycle@example.test',
  /** 08 — Ad-block must return ≥1 ad for an active ads/popup campaign (see TEST_ADS_CAMPAIGN_PLATFORM_DOMAIN or admin discovery) */
  adsFromRunningCampaign: 'extension.test.08-ads-from-running-campaign@example.test',
} as const;
