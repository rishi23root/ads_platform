/**
 * Base URL for extension HTTP tests — same precedence as `src/lib/auth.ts` baseURL
 * (`BETTER_AUTH_BASE_URL` → `BETTER_AUTH_URL`), with optional
 * `EXTENSION_INTEGRATION_BASE_URL` override when the API host differs from auth.
 *
 * Requires `EXTENSION_INTEGRATION=1` (or `EXTENSION_INTEGRATION_RUN=1`) so `pnpm test`
 * stays offline-safe when `.env.local` points at localhost but no dev server is up.
 */
export function extensionIntegrationBaseUrl(): string {
  const enabled =
    process.env.EXTENSION_INTEGRATION === '1' ||
    process.env.EXTENSION_INTEGRATION_RUN === '1';
  if (!enabled) return '';
  const raw =
    process.env.EXTENSION_INTEGRATION_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    '';
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}
