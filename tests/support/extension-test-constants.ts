/**
 * Constants for extension integration tests.
 *
 * Tests should call `registerOrLoginExtensionEndUser` from `extension-register-or-login.ts`, scrub
 * `enduser_events` for these users as needed, and avoid deleting `end_users` rows so reruns stay cheap.
 */
import { EXTENSION_SHARED_USER_EMAILS } from './extension-shared-fixture-emails';

export const EXTENSION_INTEGRATION_PASSWORD = 'ExtensionTest!Auth99';

/** ISO2 for `x-vercel-ip-country` on extension login in tests (mimics Vercel edge; login uses headers only). */
export const EXTENSION_INTEGRATION_COUNTRY_CODE = 'US';

export const EXTENSION_INTEGRATION_LOGIN_HEADERS = {
  'Content-Type': 'application/json',
  'x-vercel-ip-country': EXTENSION_INTEGRATION_COUNTRY_CODE,
} as const;

export { EXTENSION_SHARED_USER_EMAILS };
