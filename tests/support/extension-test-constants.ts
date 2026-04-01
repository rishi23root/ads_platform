/**
 * Constants for extension integration tests.
 *
 * Tests should call `registerOrLoginExtensionEndUser` from `extension-register-or-login.ts`, scrub
 * `enduser_events` for these users as needed, and avoid deleting `end_users` rows so reruns stay cheap.
 */
import { EXTENSION_SHARED_USER_EMAILS } from './extension-shared-fixture-emails';

export const EXTENSION_INTEGRATION_PASSWORD = 'ExtensionTest!Auth99';

export { EXTENSION_SHARED_USER_EMAILS };
