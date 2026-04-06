# Extension API v2 (SSE + granular REST)

Handoff doc for extension implementers. **v2** reduces per-visit work: one **SSE** connection delivers config, hydrated campaigns (ads, popups, notifications, redirects), and `frequencyCounts`. **Redirects:** prefetch with **`POST /api/extension/serve/redirects`** (or SSE **`init`**), match on each visit, then **`POST /api/extension/events`** with **`type: "redirect"`** and **`campaignId`**, then navigate — see [Redirects: local cache](#redirects-local-cache-recommended). **`POST /api/extension/serve/ads`** returns **ads/popups** only and logs **`ad`** / **`popup`** for that visit. **`serve/redirects`** does **not** log **`redirect`** rows; telemetry for a redirect fire is always client-reported via **`events`** (or use **legacy** **`ad-block`** which still logs **`redirect`** server-side when it returns a match). **Notifications** use SSE + **`POST /api/extension/events`**. **Visits** batch via **`POST /api/extension/events`**.

**Legacy:** `POST /api/extension/ad-block` remains supported. Response JSON includes **`redirects`** alongside **`ads`** and **`notifications`** (server may log **`redirect`** when rules match the request `domain`).

## Authentication

- `POST /api/extension/auth/register` | `login` | `logout` | `GET /api/extension/auth/me`
- Send **`Authorization: Bearer <token>`** on REST calls.

**Register**

- **Input:** `POST /api/extension/auth/register`  
  - **Headers:** `Content-Type: application/json` — **no** `Authorization` required.  
  - **Rules:** supply **`identifier`** (anonymous / guest) **or** **`email` + `password`** (length 8–128). Optional **`name`** (string, ≤255), **`plan`**: `"trial"` | `"paid"`.  
  - **`identifier`** (when present): trim, length **8–255**, pattern **`^[a-zA-Z0-9_-]+$`** (UUID with hyphens is valid).

  Example bodies:

  ```json
  { "identifier": "<stable device id>" }
  ```

  ```json
  { "email": "user@example.com", "password": "<8+ chars>" }
  ```

  ```json
  { "email": "user@example.com", "password": "<8+ chars>", "identifier": "<same device id>" }
  ```

- **Output (success):** **`200`** or **`201`** with JSON:

  ```json
  {
    "token": "<bearer secret>",
    "expiresAt": "<ISO-8601>",
    "user": {
      "id": "<uuid>",
      "email": "<string | null>",
      "identifier": "<string>",
      "name": "<string | null>",
      "plan": "<string>",
      "banned": false,
      "country": "<string | null>",
      "startDate": "<ISO-8601 | null>",
      "endDate": "<ISO-8601 | null>",
      "createdAt": "<ISO-8601>",
      "updatedAt": "<ISO-8601>"
    },
    "identifierRegenerated": true
  }
  ```

  - Omit **`identifierRegenerated`** unless the server issued a **new** device id (see below).  
  - **Anonymous:** **201** = new row for this `identifier`; **200** = same `identifier` as an existing **anonymous** row, **new session** (same `user.id`).  
  - **Anonymous collision:** if `identifier` is already tied to an **email** account, **201** + **`identifierRegenerated: true`** + new anonymous row — **persist `user.identifier`**.  
  - **Email only** (no `identifier`): server allocates **`user.identifier`** as **`ext_…`** — **persist** it for later register/login/events.  
  - **Email + `identifier`:** upgrades the existing **anonymous** row when it matches; **409** if **email** belongs to a **different** user. If the device id sits on **another** email-backed row while the email is new, **201** + **`identifierRegenerated: true`** (new row + server id). Insert races may retry with a generated id.

- **Output (errors):**  
  - **`400`** — `{ "error": "Invalid JSON" }` or `{ "error": "Validation failed", "details": { ... } }` (Zod field errors).  
  - **`403`** — `{ "error": "Account is banned" }`.  
  - **`409`** — `{ "error": "Email already registered" }` or `{ "error": "Email or identifier already in use" }`.  
  - **`500`** — `{ "error": "Failed to register" }` or other short `error` strings on rare insert/update failures.

**Login (email):** body `{ "email", "password", "identifier"?: "<same device id>" }`. Optional **`identifier`**: if an anonymous row exists for that id, the server **keeps its UUID**, **rewrites** any **`enduser_events`** rows still keyed to the email-only account’s **`user_identifier`** so they use the consolidated device **`identifier`**, moves **`payments`** from the email-only row onto the retained row, writes the email credentials onto that row, **deletes** the email-only **`end_users`** row, then issues a session for the **retained** id. Response includes top-level **`identifier`** (canonical, same as **`user.identifier`**) and **`identifierReplaced: true`** when the client-sent device id is **not** the one stored after merge (update local storage to **`identifier`**).

**Logout**

- **Input:** `POST /api/extension/auth/logout`  
  - **Headers:** `Authorization: Bearer <token>` (required)  
  - **Body:** none (empty body is fine; do not rely on a JSON payload)

- **Output:**
  - **`200`** — **`{ "ok": true }`** — the session for that bearer token is deleted server-side; the token must not be reused.
  - **`401`** — **`{ "error": "Authorization Bearer token required" }`** if the header is missing or not a Bearer token the handler can read.

After logout, clear the stored token locally; for guest/anonymous mode you must obtain a **new** session (e.g. anonymous **`register`** with the **same** persisted device **`identifier`**, per lifecycle above).

**Device `identifier` vs `user.id`:** `user.id` is the server’s **`end_users` primary key** (always present in `user`). **`identifier`** is the **install / device id** you generate on the client (e.g. UUID), store in **extension local storage**, and send as `identifier` on register/login when linking or consolidating accounts. Format must match the API: 8–255 chars, `^[a-zA-Z0-9_-]+$` (standard UUID strings with hyphens are fine).

**Recommended extension lifecycle**

1. **Install** — generate a random UUID (or other stable string meeting the regex), save in local storage as the canonical **device identifier**.
2. **Anonymous session** — `POST …/auth/register` with `{ "identifier": "<that value>" }` so the backend creates or resumes the anonymous `end_users` row tied to that device id.
3. **First-time email signup** — `POST …/auth/register` with `{ "email", "password", "identifier" }` using the **same** stored value so the server upgrades **the same `end_users.id`** (no duplicate user).
4. **Login** — `POST …/auth/login` with `{ "email", "password", "identifier"?: … }`. Include **`identifier`** whenever you still have the local device id: it lets the server merge an email-only account with the prior anonymous row if needed.
5. **Sync from server** — every auth response and **`GET …/auth/me`** (and v2 SSE **`init`** `user`) includes **`user.identifier`** (always set for new and migrated accounts). **Login** also returns top-level **`identifier`**. If **`identifierRegenerated`** or **`identifierReplaced`** is true, **replace** the stored device id with the response **`identifier`** / **`user.identifier`**.

**SSE:** Browsers `EventSource` cannot set custom headers. Use either:

- **`GET /api/extension/live?token=<bearer>`** (query param), or  
- **`fetch()`** streaming from a service worker with **`Authorization`** header.

## `GET /api/extension/live` (Server-Sent Events)

**Auth:** Bearer header **or** query `token` (same value as Bearer).

**First event:** `event: init`  

**Data (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `user` | object | Public end-user fields (id, email, plan, dates, …). |
| `domains` | `string[]` | Canonical platform hostnames (deduped). |
| `platforms` | `{ id, domain }[]` | Use to resolve `campaign.platformIds` → current tab platform. |
| `campaigns` | array | Active, hydrated campaigns: `campaignType`, rules, `ad` / `notification` / `redirect` payloads. |
| `frequencyCounts` | `Record<string, number>` | Per-campaign event counts for this user (`campaignId` → count). |

**Subsequent events** (when Redis is configured; otherwise only `init` is sent):

| SSE `event` | When | Payload (JSON) |
|-------------|------|----------------|
| `campaign_updated` | Admin/campaign publish | `{ campaignId, campaign \| null }` — `null` removes campaign from client cache. |
| `platforms_updated` | Platforms changed | `{ platforms: [{ id, domain }], domains: string[] }` |
| `redirects_updated` | Redirect rows changed | `{ type: "redirects_updated" }` — refetch init or wait for `campaign_updated`. |
| `ads_updated` | Ad rows changed | `{ type: "ads_updated" }` |
| `notifications_updated` | Notification rows changed | `{ type: "notifications_updated" }` |
| `frequency_updated` | After `POST /events` (this user) | `{ campaignId, count }` — only if message `endUserId` matches (server-side filter). |

## `POST /api/extension/serve/ads`

**Body:** `{ "domain": "<hostname>", "userAgent"?: string }`  
**Response:** `{ "ads": [ … ] }` — **ads** and **popup** creatives only.

Server applies platform match, frequency, geo, schedule, and audience for **ads** and **popup** campaigns. Inserts **`enduser_events`** with type **`ad`** or **`popup`** when creatives are returned. Does **not** insert **`visit`** rows (visits are batched via **`POST /events`**). **Redirect** campaigns use **`POST /api/extension/serve/redirects`**.

## `POST /api/extension/serve/redirects`

**Body:** `{ "domain"?: "<hostname>" }` — JSON object; **`domain`** optional. Omit **`domain`** to list every **redirect** campaign that passes **schedule** (campaign dates + status) and **frequency / count** caps (plus geo + audience + time-of-day), regardless of platform. With **`domain`**, further narrow to campaigns whose **`platformIds`** match that hostname’s platform (same scoping as **`serve/ads`**).

**Response:** Each item includes a **`domain_regex`** (use with `new RegExp(domain_regex, 'i')` on the normalized tab **hostname**), **`target_url`**, campaign **`date_till`** (ISO end time or `null`), **`count`** (`used` / `max` / `remaining` for frequency caps), and **`campaignId`** for **`POST /events`**.

```json
{
  "redirects": [
    {
      "campaignId": "<uuid>",
      "domain_regex": "^www\\.example\\.com$",
      "target_url": "https://…",
      "date_till": "2026-12-31T00:00:00.000Z",
      "count": { "used": 0, "max": 3, "remaining": 3 }
    }
  ]
}
```

`count.max` / `count.remaining` are `null` when the campaign is not capped (**`only_once`** → `max: 1`; **`specific_count`** → `max` = `frequencyCount`; other frequency types → no numeric cap in this field).

**Matching:** `domain_regex` is built server-side with **`redirectSourceToHostnameRegex`** — equivalent to **`redirectSourceMatchesVisit`** in [`src/lib/domain-utils.ts`](../src/lib/domain-utils.ts). Normalize the tab hostname (lowercase, hostname only), then `new RegExp(domain_regex, 'i').test(hostname)`.

**Does not** write **`enduser_events`**. After the user is redirected, send **`POST /events`** with **`type: "redirect"`**, **`campaignId`**, **`domain`** (pre-redirect hostname). **Refetch** this endpoint (or SSE **`init`**) when counts or schedules change—use **`frequency_updated`** and campaign / redirect update events as hints.

## `POST /api/extension/events`

Report **notification**, **redirect** (client-side delivery only), and batched **visit** telemetry.

**Body:**

```json
{
  "events": [
    { "type": "visit", "domain": "<hostname>" },
    { "type": "visit", "domain": "<hostname>", "visitedAt": "2026-04-01T12:34:56.000Z" },
    { "type": "notification", "campaignId": "<uuid>", "domain": "<visit hostname>" },
    { "type": "redirect", "campaignId": "<uuid>", "domain": "<visit hostname>" }
  ]
}
```

- Minimum 1 event, max **50** per request (fits a flush of **5–10** visits plus mixed notification/redirect rows).  
- **`visit`:** no `campaignId`. The extension should **maintain a local queue** of navigations: store **`domain`** (and **`visitedAt`** when the user landed on the tab) for each relevant visit. When the queue reaches **5–10** entries—or on idle/browser unload as a safety flush—send them in **one** `POST /events` payload. Optional **`visitedAt`** is ISO 8601 from the client clock for ordering; the server always records receipt in `created_at` as well.  
- **Do not** send `ad` / `popup` here; those are logged by **`serve/ads`**.

### Redirect: async event + fast navigation

On redirect match:

1. **Start** `POST /events` **immediately** (request hits the server ASAP).  
2. **Do not** `await` the response before navigating (`tabs.update` / `location`).  
3. Prefer **`fetch(..., { keepalive: true })`** from the **extension background / service worker** so the request is less likely to abort when the tab navigates.  
4. On failure, queue and retry with backoff.

Server inserts rows and publishes **`frequency_updated`** on Redis for this user’s SSE connections.

## Redirects: local cache (recommended)

Many extensions **prefetch** redirect rules from **`POST /api/extension/serve/redirects`** (body `{}` for all eligible rules after server date/count/filters, or `{ "domain": "<tab host>" }` to scope by platform) **or** mirror redirect rows from SSE **`init`** **`campaigns`**. Prefer **`serve/redirects`** when you want **`domain_regex`**, **`target_url`**, **`date_till`**, and **`count`** in one response.

1. **Hydrate:** `POST /api/extension/serve/redirects` on session start, periodically, or after **`campaign_updated`** / **`redirects_updated`**. Store **`campaignId`**, **`domain_regex`**, **`target_url`**, **`date_till`**, **`count`**. (From SSE **`init`**, use campaign **`id`**, **`redirect.sourceDomain`**, **`redirect.destinationUrl`**, etc., and derive regex client-side or reuse the same helpers as in **`domain-utils`**.)

2. **Stay fresh:** Re-fetch **`serve/redirects`**, merge SSE patches, and update local counters when you receive **`frequency_updated`**.

3. **On each navigation:** Normalize tab hostname, test **`domain_regex`**. Respect **`date_till`** and **`count.remaining`** on the client if you cache long-lived (server already filtered at fetch time; refresh to avoid stale caps).

4. **On a qualifying match:** **`POST /events`** (**`type: "redirect"`**) with **keepalive** / **no await**, then **navigate** to **`target_url`** (see **Redirect: async event + fast navigation**).

5. **Then ads:** If **no** redirect ran, **`POST /api/extension/serve/ads`** for that hostname.

## Client responsibilities

- **Visits:** append `{ domain, visitedAt? }` to a **local queue** on each navigation you care about; when length is **5–10** (policy choice) or on periodic/flush triggers, **`POST /events`** with one `{ type: "visit", domain, visitedAt? }` per queued entry, then clear the queue.  
- **Redirects:** prefetch with **`POST /api/extension/serve/redirects`** (see section above) or SSE; match locally → **`POST /events`** → navigate; then **`serve/ads`**. **Legacy `ad-block`** can still log **`redirect`** server-side when you use that endpoint instead.  
- **Ads/popups:** call **`serve/ads`** with the tab hostname; response is **`ads`** only.  
- **Notifications:** filter SSE `campaigns` where `campaignType === "notification"`, match `platformIds` + local frequency rules + time windows, display, then **`POST /events`** (can be combined in the same request as a visit batch if you keep under 50 items).

## Rate limits (optional)

With `REDIS_URL` set: separate per-IP buckets for `ad-block`, `serve-ads`, `serve-redirects`, and `events` (120 req/min each).

## Extension implementation checklist

Use this as a task list for a new extension build (v2):

1. **Auth** — Register or login; persist **Bearer token** and **`user.identifier`** (see [Authentication](#authentication) and numbered lifecycle under **Recommended extension lifecycle** in that section).
2. **Realtime config** — Connect **`GET /api/extension/live`** (`?token=` or streaming fetch with `Authorization`) and handle **`init`** + **`campaign_updated`** / **`frequency_updated`** (and other events as needed).
3. **Redirect rules** — `POST /api/extension/serve/redirects` (`{}` or `{ "domain" }`); cache **`domain_regex`**, **`target_url`**, **`campaignId`**, **`date_till`**, **`count`**; on tab navigation, regex-match host → **`POST /api/extension/events`** (`type: "redirect"`) → navigate (see [Redirect: async event + fast navigation](#redirect-async-event--fast-navigation)).
4. **Ads / popups** — When no redirect applies, **`POST /api/extension/serve/ads`** with tab hostname; render **`ads`** from the response (server logs **`ad`** / **`popup`**).
5. **Notifications** — From SSE **`campaigns`**, match locally, show UI, then **`POST /events`** (`type: "notification"`).
6. **Visits** — Batch **`type: "visit"`** rows (5–10 per flush) via **`POST /events`**.
7. **Legacy** — Only if required: **`POST /api/extension/ad-block`** still returns **`redirects`** and may log **`redirect`** server-side for matching domains.

## Tests

```bash
pnpm test:extension-v2
```

Requires `EXTENSION_INTEGRATION=1`, running app, and DB. Covers **`live`** (first SSE frame), **`serve/ads`**, **`serve/redirects`**, and **`events`**. See [`tests/user-flow/extension/extension-v2-http.integration.test.ts`](../tests/user-flow/extension/extension-v2-http.integration.test.ts).
