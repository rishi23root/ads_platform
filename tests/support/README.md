# Test support code

Shared helpers for Vitest (not test cases themselves).

| File | Purpose |
|------|---------|
| `extension-test-base-url.ts` | Resolves HTTP base URL for extension integration tests; requires `EXTENSION_INTEGRATION=1` or `EXTENSION_INTEGRATION_RUN=1`. |
| `extension-test-constants.ts` | Shared emails/password for integration runs. |
| `extension-register-or-login.ts` | Login; register on 401; returns token + `endUserId`. |
| `extension-serve-ads-request.ts` | `POST /api/extension/serve` with 401 retry (`postExtensionServe`). |
| `extension-events-request.ts` | `POST /api/extension/events` with 401 retry. |
| `extension-sse-first-event.ts` | Reads the first SSE frame from `/api/extension/live?token=…` (Vitest / Node). |

Imported from tests via relative paths, e.g. `../support/extension-test-base-url` or `../../support/extension-test-base-url`.
