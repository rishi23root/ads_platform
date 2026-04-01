# Test support code

Shared helpers for Vitest (not test cases themselves).

| File | Purpose |
|------|---------|
| `extension-test-base-url.ts` | Resolves HTTP base URL for extension integration tests; requires `EXTENSION_INTEGRATION=1` or `EXTENSION_INTEGRATION_RUN=1`. |
| `extension-test-constants.ts` | Optional constants for manual or future tests (see file exports). |

Imported from tests via relative paths, e.g. `../support/extension-test-base-url` or `../../support/extension-test-base-url`.
