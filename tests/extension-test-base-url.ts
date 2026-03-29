/**
 * Base URL for extension HTTP tests — same precedence as `src/lib/auth.ts` baseURL
 * (`BETTER_AUTH_BASE_URL` → `BETTER_AUTH_URL`), with optional
 * `EXTENSION_INTEGRATION_BASE_URL` override when the API host differs from auth.
 */
export function extensionIntegrationBaseUrl(): string {
  const raw =
    process.env.EXTENSION_INTEGRATION_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    '';
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}
