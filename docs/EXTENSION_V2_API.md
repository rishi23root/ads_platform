# Extension API v2 (SSE + granular REST)

Handoff doc for extension implementers. **v2** reduces per-visit work: one **SSE** connection delivers config, hydrated campaigns (ads, popups, notifications, redirects), and `frequencyCounts`. Per-visit **ads/popups** (and **redirects** matched on the server for that hostname) use **`POST /api/extension/serve/ads`**. **Notifications** and **redirects** that you apply **only from the client** (without relying on `serve/ads`) are reported with **`POST /api/extension/events`**. **Visit** analytics are also reported via **`POST /api/extension/events`**, batched from a local queue (see below)—the server does **not** emit `visit` rows from `serve/ads`.

**Legacy:** `POST /api/extension/ad-block` remains available unchanged.

## Authentication

- `POST /api/extension/auth/register` | `login` | `logout` | `GET /api/extension/auth/me`
- Send **`Authorization: Bearer <token>`** on REST calls.

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
**Response:** `{ "ads": [ … ], "redirects": [ { sourceDomain, includeSubdomains, destinationUrl } ] }`

Server applies platform match, frequency, geo, schedule, audience — same rules as legacy ad-block for **ads, popup, and redirect** (redirect rules whose source matches `domain`). Inserts **`enduser_events`** with type `ad`, `popup`, or `redirect` when inventory is returned. If nothing is served for this call, inserts a single **`request`** row (no fill). Does **not** insert **`visit`** rows (visits are batched via **`POST /events`**).

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

## Client responsibilities

- **Visits:** append `{ domain, visitedAt? }` to a **local queue** on each navigation you care about; when length is **5–10** (policy choice) or on periodic/flush triggers, **`POST /events`** with one `{ type: "visit", domain, visitedAt? }` per queued entry, then clear the queue.  
- **Ads/popups (and server-matched redirects):** call **`serve/ads`** with the tab hostname; handle `ads` / `redirects` in the response.  
- **Notifications:** filter SSE `campaigns` where `campaignType === "notification"`, match `platformIds` + local frequency rules + time windows, display, then **`POST /events`** (can be combined in the same request as a visit batch if you keep under 50 items).  
- **Redirects** you trigger **without** going through **`serve/ads`** (e.g. pure client match from SSE): match `redirect.sourceDomain` / `includeSubdomains` to the visit host (mirror server `redirectSourceMatchesVisit` in [`src/lib/domain-utils.ts`](../src/lib/domain-utils.ts)), navigate, then fire-and-forget **`POST /events`** with type **`redirect`**.

## Rate limits (optional)

With `REDIS_URL` set: separate per-IP buckets for `ad-block`, `serve-ads`, and `events` (120 req/min each).

## Tests

```bash
pnpm test:extension-v2
```

Requires `EXTENSION_INTEGRATION=1`, running app, and DB. See [`tests/user-flow/extension/extension-v2-http.integration.test.ts`](../tests/user-flow/extension/extension-v2-http.integration.test.ts).
