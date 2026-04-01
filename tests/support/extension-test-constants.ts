/**
 * Three shared extension end-users for integration tests (stable identities; RFC 2606 domain).
 *
 * Tests should call `registerOrLoginExtensionEndUser` from `extension-register-or-login.ts`, scrub
 * `enduser_events` for these users as needed, and avoid deleting `end_users` rows so reruns stay cheap.
 */
export const EXTENSION_INTEGRATION_PASSWORD = 'ExtensionTest!Auth99';

export const EXTENSION_SHARED_USER_EMAILS = [
  'extension.shared.1@example.test',
  'extension.shared.2@example.test',
  'extension.shared.3@example.test',
] as const;
