# Active Context

## Current Work Focus

The project is in a stable state with all core features implemented. The most recent pass was a full audit + fix pass on every extension and admin endpoint, focused on correctness, security, performance, and observability of the ad-serving hot path.

## Recent Changes

### 2026-04-25 — Legacy extension cleanup (docs + scripts + memory-bank)

- **`memory-bank/systemPatterns.md`:** Auth wording no longer says “ad-block”; added bullet for `extension-campaign-qualify.ts`.
- **`docs/test-extension-log.sh`:** Header comments and banner no longer imply `GET /domains`; “Extension v2 serve test script”.
- **`docs/EXTENSION_LEGACY_REMOVAL_MIGRATION.md`:** Historical banner + pointer to the client contract.
- **`docs/EXTENSION_CLIENT_CONTRACT.md`:** “Removed endpoints” section clarifies table is not current surface + link to legacy doc.
- **`README.md`:** Extension section leads with v2 surface, then states old combined endpoint is removed.
- **`tests/user-flow/extension/extension-event-types-frequency.integration.test.ts`:** Integration label no longer says “ad-block”.
- **`src/lib/campaign-api-target-payload.ts`:** JSDoc references `extension-campaign-qualify.ts`.
- Verification: `pnpm lint`, `pnpm test:extension`, `pnpm test:extension-v2`, `pnpm test:sse-live` (run in repo).

### 2026-04-25 — Full rename: ad-block → campaign-qualify + serve-error

- **`src/lib/extension-ad-block-qualify.ts` → `src/lib/extension-campaign-qualify.ts`**: Module renamed; `isExtensionUserNewForAdBlock` → `isExtensionUserNew`; stale `ad-block` references in the module-level JSDoc stripped.
- **`src/lib/extension-ad-block-handler.ts` → `src/lib/extension-serve-error.ts`**: `ExtensionAdBlockError` → `ExtensionServeError`; class `name` updated; error message default updated.
- **`tests/function-based/extension-ad-block-qualify.test.ts` → `tests/function-based/extension-campaign-qualify.test.ts`**: Import path and describe label updated; `isExtensionUserNewForAdBlock` → `isExtensionUserNew`.
- **`package.json` `test:extension` script**: points to the renamed test file.
- **`src/lib/redis.ts` comments**: three `ad-block` references in JSDoc updated to `serve/live`.
- **`docs/EXTENSION_CLIENT_CONTRACT.md`**: stale migration-guide link sentence removed from the preamble.
- **`tests/function-based/README.md`** and **`tests/README.md`**: table rows and code block updated to the new names.
- Importers updated: `extension-serve-handlers.ts`, `extension-live-init.ts`, `extension-campaign-rule-mapper.ts`.
- `tsc --noEmit` exits 0 after all changes.

### 2026-04-25 — Second audit review: access control + app user detail refactor

- **Campaign IDOR:** `getAccessibleCampaignById` in [`src/lib/campaign-access.ts`](../src/lib/campaign-access.ts) now returns a row for non-`admin` only when `campaigns.createdBy` matches the session user; admins still see all campaigns. Tests updated in [`tests/task-based/auth-scope.test.ts`](../tests/task-based/auth-scope.test.ts).
- **Extension user events (dashboard):** [`src/lib/events-dashboard.ts`](../src/lib/events-dashboard.ts) adds `eventsAccessScopeForRole` and applies it to aggregate/list/export queries; non-admins only see `enduser_events` rows linked to their own campaigns. [`endEventsRequiresCampaignOwnerJoin`](../src/lib/events-dashboard.ts) is now `true` for role `user`. [`src/app/api/events/chart/route.ts`](../src/app/api/events/chart/route.ts) applies the same scope.
- **App user (end user) analytics API:** Non-admins get empty analytics in [`src/lib/end-user-analytics.ts`](../src/lib/end-user-analytics.ts). [`GET /api/end-users/[id]/analytics`](../src/app/api/end-users/[id]/analytics/route.ts) requires `admin`.
- **App user admin-only reads:** [`GET` manage](../src/app/api/end-users/[id]/manage/route.ts) and [`GET` sessions](../src/app/api/end-users/[id]/sessions/route.ts) require `admin` (previously any authenticated staff). [`GET` per-user event list under `/api/end-users/[id]/events`](../src/app/api/end-users/[id]/events/route.ts) requires `admin`.
- **User detail RSC + snapshot:** [`getEndUserDashboardSnapshot`](../src/lib/end-user-dashboard.ts) takes optional `viewer` (`{ id, role }`); non-admins get zeroed payment/session aggregates and event aggregates scoped to their campaigns. [`users/[id]/page`](../src/app/(protected)/users/[id]/page.tsx) omits initial payment list for non-admins and passes `viewer` into the snapshot.
- **Legacy extension test removed:** [`tests/user-flow/extension/extension-user-flow.integration.test.ts`](../tests/user-flow/extension/extension-user-flow.integration.test.ts) (called removed ad-block/domains) deleted; [`tests/user-flow/extension/README.md`](../tests/user-flow/extension/README.md) updated.
- **UI extraction (app user detail):** Shared types in [`src/components/end-user-detail-types.ts`](../src/components/end-user-detail-types.ts), formatting helpers in [`src/lib/end-user-detail-formatting.ts`](../src/lib/end-user-detail-formatting.ts), KPI strip in [`src/components/user-detail-kpi-strip.tsx`](../src/components/user-detail-kpi-strip.tsx), [`end-user-detail-client.tsx`](../src/components/end-user-detail-client.tsx) slimmed.

### 2026-04-25 — Redirect `domain_regex` (subdomain + www)

- **`src/lib/domain-utils.ts`:** `redirectSourceToHostnameRegex` / `redirectSourceMatchesVisit` strip a leading `www.` from the normalized source when `includeSubdomains` is true so patterns anchor to the root (e.g. `^(?:.+\.)?ndtv\.com$` instead of `^(?:.+\.)?www\.ndtv\.com$`). New `normalizeDomainForRedirectStorage` used by redirect APIs.
- **`POST/PUT /api/redirects`:** Persist hostname-normalized `source_domain` via that helper.
- **Migration `0007_normalize_redirect_source_domains.sql`:** Rows with `source_domain` like `www.%` → strip prefix, set `include_subdomains = true`.
- **Docs:** `EXTENSION_CLIENT_CONTRACT.md` example `domain_regex` updated to the include-all-subdomains shape.
- **Tests:** `tests/function-based/domain-utils-redirect-regex.test.ts` ndtv verification cases.

### 2026-04-21 — Full audit & fix pass (extension + admin)

Scope: "find and fix as I go" across `/api/extension/*` (highest priority) plus every admin endpoint that feeds it. 11 atomic batches, all landed and verified with `pnpm tsc --noEmit` + `pnpm lint`.

- **Batch A — `/extension/events`:** outer `try/catch` + structured `logger.error`; `skipped` campaign ids deduped via `Set`; enforces `Content-Type: application/json` (returns `415`); clamps out-of-range `visitedAt` (±7d past / ±1d future) instead of rejecting; rate-limited (120/min/end-user).
- **Batch B — `/extension/serve`:** removed dead catch branch for the legacy extension error type (now `ExtensionServeError` in `extension-serve-error.ts`); `500` responses strip `error.message` in production; enforces `415`; event-row writes moved off the response path via Next.js `after()`; rate-limited (300/min/end-user).
- **Batch C — `/extension/live` (SSE):** subscriber errors now log + close the stream instead of being swallowed; `campaign_updated` gate simplified (full payload always rebuilt); heartbeat 40s → 15s (env-configurable via `REALTIME_LIVE_HEARTBEAT_MS`) to survive proxy idle timeouts; shared campaign-domains list cached in Redis with 5s TTL to cut DB round-trips on fan-out.
- **Batch D — Rate limiting + log scrubbing:** new `src/lib/rate-limit.ts` (Redis-backed fixed window, in-memory fallback); applied to `/auth/login` (10/min/IP), `/auth/register` (5/min/IP), `/serve` + `/events`; emails masked and Bearer tokens scrubbed in logs.
- **Batch E — CORS:** `/api/extension/*` now handles `OPTIONS` preflight and reflects `Origin` on real responses.
- **Batch F — IDOR gate:** new `requireApiSession({ role })` helper in `src/lib/dal.ts`; applied to every `/api/end-users/[id]/**` admin route so only `admin` can read/manage end-user data.
- **Batch G — Transactional writes:** `POST /payments` (insert + optional end-user update) and `PATCH /payments/[id]` (update + optional end-user update) now wrapped in `db.transaction`.
- **Batch H — Schema:** migration `0006_hotpath_indexes.sql` (partial index on `campaigns` active window, indexes on `enduser_events.domain`/`country` and `enduser_sessions.expires_at`, optional `pg_trgm` GIN on `enduser_events.domain` gated by privilege check); Drizzle schema updated with matching index declarations and `$onUpdateFn` on every `updatedAt` column.
- **Batch I — Env + logging:** `REDIS_URL`, `ENDUSER_SESSION_DAYS`, `REALTIME_LIVE_HEARTBEAT_MS` added to the Zod env schema; lazy `env` proxy fails fast at runtime (only lenient during `next build`); all `console.error/warn` in the extension hot path replaced with structured `logger`.
- **Batch J — CSP:** `src/proxy.ts` now emits a baseline `Content-Security-Policy` in production on top of existing HSTS / X-Frame / X-Content-Type / Referrer / Permissions headers.
- **Batch K — Pagination:** new `src/lib/pagination.ts`; admin list GETs (`/ads`, `/platforms`, `/redirects`, `/members`, `/target-lists`) accept `limit`/`offset` with safe defaults (500, capped 1000). Response shape unchanged (still raw array) for backward compatibility.

**Open product decision deferred to user:** time-of-day window for `time_based` campaigns is still evaluated in server-local time (`d.getHours()`). Options: (a) document as UTC, (b) derive from user geo, (c) add `campaigns.timezone` IANA column. Defaulting to (a) until the user picks.

### 2026-01-27 - Documentation Update (historical)
- Updated `readme.md` with current features and accurate project structure
- Created memory-bank directory with all 6 required files
- Created technical documentation (ARCHITECTURE.md, DATABASE.md)
- Updated EXTENSION_API_DOCS.md with test script reference
- Added comprehensive project documentation

### 2026-01-26 - Test Script Addition (historical)
- Created `test-extension-log.sh` script to simulate extension pull requests
- Script fetches real platforms and ads from database
- Creates test log entries for both 'ad' and 'notification' request types
- Added `pnpm test:extension-log` script to package.json
- Created `TEST_EXTENSION_LOG.md` documentation

## Next Steps

### Immediate
1. ✅ Complete documentation update (memory bank, technical docs) - DONE
2. Decide time-of-day semantics for `time_based` campaigns (UTC / geo-local / per-campaign IANA tz) — awaiting user.
3. Review extension client contract change log (2026-04-21) with the extension team and confirm no client updates required (expected: none — headers only).

### Short-term
1. ✅ API rate limiting for extension endpoints — DONE (Redis-backed with in-memory fallback).
2. ✅ Pagination on admin list endpoints — DONE (`limit`/`offset`, backward-compatible).
3. Add filtering/search capabilities to admin tables (UI side).
4. Consider adding more comprehensive structured logs around campaign qualification misses (help debug "why isn't my ad serving").

### Long-term
1. Consider adding export functionality for analytics
2. Add email notifications for admins
3. Consider adding audit logging for admin actions
4. Add bulk operations for ads/notifications

## Active Decisions

### Documentation Structure
- **Decision**: Create memory-bank directory per user rules
- **Rationale**: Maintains project context across sessions
- **Status**: ✅ Completed

### Test Script Location
- **Decision**: Keep test script in root directory
- **Rationale**: Easy to find and run
- **Status**: ✅ Implemented

### Documentation Organization
- **Decision**: Separate docs/ directory for technical documentation
- **Rationale**: Keeps technical docs separate from user-facing docs
- **Status**: ✅ Completed

## Important Patterns and Preferences

### Code Style
- TypeScript strict mode
- Server components by default
- Explicit 'use client' markers
- Consistent error handling
- Type-safe database queries

### File Organization
- One component per file
- Schema files organized by entity
- API routes match entity structure
- Clear separation of concerns

### Naming Conventions
- PascalCase for components
- camelCase for functions/variables
- kebab-case for files
- Descriptive names

## Learnings and Project Insights

### What Works Well
- Drizzle ORM provides excellent type safety
- Next.js App Router simplifies server/client separation
- shadcn/ui components provide consistent, accessible UI
- Singleton patterns work well with Next.js hot reload
- Auto-expiration reduces manual maintenance

### Challenges Encountered
- Domain format differences (full URLs vs clean domains)
- Need to handle both formats in API endpoints
- Test script needed to work with actual database data

### Best Practices Established
- Always validate environment variables at startup
- Use server-only boundaries strictly
- Consistent API response formats
- Comprehensive error handling
- Type safety throughout

## Current Status

### Completed Features
- ✅ Platform management (CRUD)
- ✅ Ad management (CRUD with scheduling)
- ✅ Notification management (CRUD with multi-platform)
- ✅ Analytics dashboard
- ✅ Extension API endpoints
- ✅ Authentication system
- ✅ Test script for extension API
- ✅ Auto-expiration of ads
- ✅ Comprehensive documentation

### Working Features
- Dashboard statistics and charts
- Request logging and analytics
- Domain-based filtering
- Date range filtering for notifications
- Status management for ads

### Known Limitations
- No bulk operations for ads/notifications
- No export functionality for analytics
- No audit logging for admin actions (structured `logger` in place — full audit log not yet)
- `time_based` campaign windows compared in server-local time (see Open product decision above)

## Development Notes

### Testing
- Use `pnpm test:extension-log` to test extension API
- Script uses real database data
- Creates actual log entries visible in analytics

### Database
- All migrations in `drizzle/migrations/`
- Use `pnpm db:generate` before committing schema changes
- Use `pnpm db:push` for quick dev iterations

### Environment
- All required variables validated at startup
- Missing variables cause application to fail fast
- Use `.env.local` for local development

### Documentation
- Memory bank files in `memory-bank/` directory
- Technical docs in `docs/` directory
- User-facing docs in root directory
- All documentation is up-to-date
