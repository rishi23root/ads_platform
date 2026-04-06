# Extension user-flow tests

Integration tests for the **extension** surface: register/login, domains, ad-block, campaign frequency caps, and event typing in the database.

## Files

| File | What it validates |
|------|-------------------|
| `extension-user-flow.integration.test.ts` | HTTP: `POST` register/login, `GET` domains, `POST` ad-block with bearer token; asserts status codes, token shape, JSON arrays. |
| `extension-event-types-frequency.integration.test.ts` | Creates campaigns, fires many ad-block requests, asserts per-campaign caps and `enduser_events` row types/counts via Drizzle + live DB. |
| `extension-multi-user-frequency-load.integration.test.ts` | 10 users × 15 requests per campaign type (`ads`, `popup`, `notification`, `redirect`), asserts per-user `specific_count` cap and DB event rows; runs types sequentially. |
| `extension-v2-http.integration.test.ts` | v2: `GET /live` (first SSE `init`), `POST /serve/ads`, `POST /serve/redirects`, `POST /events` validation and auth. |

## Prerequisites

- `EXTENSION_INTEGRATION=1` or `EXTENSION_INTEGRATION_RUN=1`
- Base URL set (see [`../../support/extension-test-base-url.ts`](../../support/extension-test-base-url.ts))
- **Next app + DB running** and matching `DATABASE_URL` in env for the DB-heavy test

**Vitest runs test files sequentially** (`fileParallelism: false` in [`vitest.config.ts`](../../vitest.config.ts)). Extension suites reuse the same shared login emails and single-session tokens; running multiple integration files in parallel causes **401** and bogus frequency counts.

## How to run

All extension integration tests:

```bash
pnpm test:integration
```

Single file:

```bash
EXTENSION_INTEGRATION=1 pnpm vitest run tests/user-flow/extension/extension-user-flow.integration.test.ts
```

Multi-user frequency load only (long-running):

```bash
pnpm test:frequency-load
```

v2 endpoints only:

```bash
pnpm test:extension-v2
```

Verbose:

```bash
pnpm test:integration -- --reporter=verbose
```

## Expected output

- When base URL is unset: suites use `describe.skip` → Vitest reports **skipped** tests, still exit 0.
- When live: **PASS** with HTTP 200/201 and expected JSON/DB shapes; failures show response or query mismatch.

## Manual HTTP smoke test

[`docs/test-extension-log.sh`](../../../docs/test-extension-log.sh) — curl-style flow with `jq` (documented separately).

## Flow (HTTP suite)

```mermaid
sequenceDiagram
  participant T as Vitest
  participant API as Next API
  T->>API: POST register
  API-->>T: 201 token user
  T->>API: POST login
  API-->>T: 200 token
  T->>API: GET domains
  API-->>T: domains array
  T->>API: POST ad-block Bearer token
  API-->>T: ads notifications arrays
```

## Flow (frequency + DB suite)

```mermaid
flowchart TD
  setup[Create user campaigns in DB] --> loop[Many ad-block requests]
  loop --> count[Count enduser_events rows]
  count --> cap[Assert cap at specific_count]
  cap --> types[Assert ad vs notification typing]
```
