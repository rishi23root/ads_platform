# Task-based tests

Higher-level **tasks** (e.g. “can this session end events for this campaign?”) using **mocked** database access — no real Postgres.

## Files

| File | What it validates |
|------|-------------------|
| `auth-scope.test.ts` | Campaign owner / admin checks and `getAccessibleCampaignById` behavior with a chained `vi.mock('@/db')` query builder. |

## How to run

```bash
pnpm test:unit
```

Or:

```bash
pnpm vitest run tests/task-based/
```

## Expected output

- All tests **PASS** with exit 0.
- Mocks reset in `beforeEach` where defined.

## Typical failures

- Mock chain not matching actual `@/db` usage after refactors.
- Type mismatches on mocked row shapes.

## Flow

```mermaid
flowchart TD
  start[Task test] --> mock[vi.mock @/db]
  mock --> session[Build session / args]
  session --> call[Call access helper]
  call --> dbMock[Mock limit resolves row or empty]
  dbMock --> assert[expect row or null]
```
