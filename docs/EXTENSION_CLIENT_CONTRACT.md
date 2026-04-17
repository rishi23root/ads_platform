# Extension Client Contract

This document describes every API the browser extension must interact with. It is the authoritative reference for the extension team. For migration context from the legacy `ad-block` endpoint, see `[EXTENSION_LEGACY_REMOVAL_MIGRATION.md](./EXTENSION_LEGACY_REMOVAL_MIGRATION.md)`.

## Contract change log (sessions)

Append-only revision history. Newest session first.

### 2026-04-17 — Minimal `serve` payloads; no creative caching of `serve`

- **Breaking:** Each object in `POST /api/extension/serve` response arrays (`ads`, `popups`, `notifications`) contains only **`id`** (campaign id) and the creative: **`ad`** (for `ads` and `popups`) or **`notification`** (for `notifications`). Campaign-level fields are **not** returned (`name`, `campaignType`, `targetAudience`, `frequencyType`, `platformIds`, `countryCodes`, schedule, status, etc.) — the server has already applied targeting and caps before responding.
- **Additive:** None.
- **Unchanged:** SSE `init` / `redirects_updated` redirect items still include `frequencyType`, `frequencyCount`, and `count` so the client can enforce redirect caps without a per-navigation serve call.
- **Client actions:** Parse only `id` plus `ad` or `notification` from serve responses. Use the array bucket to distinguish inline ad vs popup vs notification. Do **not** persist or reuse serve JSON across navigations, tabs, or sessions as a creative cache (see [Per-domain creative serving](#per-domain-creative-serving--post-apiextensionserve)).

---

## Authentication

All extension routes (except `register`) require a `Bearer` token.

### Register (anonymous or email)

```
POST /api/extension/auth/register
Content-Type: application/json

{ "identifier": "<device-stable-key>" }          // anonymous install
{ "email": "...", "password": "..." }              // email registration
```

Response: `201 { token, user: { id, identifier, email, ... } }`

### Login

```
POST /api/extension/auth/login
Content-Type: application/json

{ "email": "...", "password": "..." }
```

Response: `200 { token, user }`

### Logout

```
POST /api/extension/auth/logout
Authorization: Bearer <token>
```

### Session check

```
GET /api/extension/auth/me
Authorization: Bearer <token>
```

---

## SSE live stream — `GET /api/extension/live`

This is the primary data channel. Open it immediately after obtaining a token and keep it alive.

```
GET /api/extension/live
Authorization: Bearer <token>
Accept: text/event-stream
```

> EventSource cannot set custom headers. Use the query string instead: `GET /api/extension/live?token=<token>`

### First event — `init`

Sent as soon as the connection is established. Shape:

```jsonc
{
  "user": {
    "id": "<uuid>",
    "identifier": "<stable-key>",
    "email": "user@example.com",   // null for anonymous
    "name": null,
    "plan": "trial",               // "trial" | "paid"
    "banned": false,
    "country": "US",               // ISO 3166-1 alpha-2 or null
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": null                // null = open-ended access
  },
  "domains": [
    "instagram.com",
    "facebook.com"
    // ... canonical hostnames referenced by active campaigns
  ],
  "redirects": [
    {
      "campaignId": "<uuid>",
      "domain_regex": "^(www\\.)?instagram\\.com$",
      "target_url": "https://example.com/landing",
      "date_till": "2026-12-31T23:59:59.000Z",  // null = no end date
      "count": 3,          // this user's prior event count for this campaign
      "frequencyType": "specific_count",   // "always" | "only_once" | "specific_count" | "time_based"
      "frequencyCount": 10  // null unless frequencyType === "specific_count"
    }
  ]
}
```

**What is NOT in `init`:**

- Inline ads, popups, and notification creatives — fetch per-domain via `POST /api/extension/serve` (optional `type` filter; omit to fetch all three kinds).
- `platforms` — replaced by the derived `domains` list.
- `campaigns` (full list) — not included; extensions use `serve` on demand.
- `frequencyCounts` (flat map) — replaced by per-redirect `count` on each redirect item.

### Follow-up events


| Event name              | Data                                                        | Action                                                                                   |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `platforms_updated`     | `{ "domains": [...] }`                                      | Replace cached `domains` with the new list.                                              |
| `redirects_updated`     | `{ "type": "redirects_updated", "redirects": [ … ] }`        | Replace cached redirect rules with `redirects` (same items as `init.redirects`).          |
| `ads_updated`           | `{ "type": "ads_updated" }`                                 | Invalidate any locally cached ad creatives.                                              |
| `notifications_updated` | `{ "type": "notifications_updated" }`                       | Invalidate cached notification creatives.                                                |
| `campaign_updated`      | `{ "domains", "redirect"?, "redirectRemoval"? }` | Replace cached `domains` with `domains` (same derivation as `init`). If `redirect` is present: upsert that `ExtensionInitRedirectItem` into the local redirect cache. If `redirect` is `null`, remove the cached rule whose `domain_regex` equals `redirectRemoval.domain_regex` (omit `redirectRemoval` only when the server could not resolve it—then refresh from a following `redirects_updated` if any). If `redirect` is omitted, leave redirect rules unchanged (ads / notification / popup changes). |


### Reconnect behaviour

When the stream disconnects, reconnect with `EventSource` or a manual retry loop (exponential back-off). The new `init` event will carry fresh state — no incremental diffing needed.

---

## Per-domain creative serving — `POST /api/extension/serve`

Call this on each navigation when the visited hostname is in `domains` (from `init` or `platforms_updated`). Returns qualifying **inline ad**, **popup**, and **notification** creatives for that host.

### Client obligations (serve responses)

- **No creative caching of `serve`:** Do not store serve response bodies in `chrome.storage` (or equivalent) or reuse a previous serve result on a later navigation to avoid network calls. For each visit where you need creatives, call `serve` and render from **that** response only. Targeting, geo, audience, schedule, and frequency caps are evaluated on the server at request time; caching would desync behavior from dashboard rules.
- **Allowed state:** Keep SSE-derived data (`domains`, redirect rules from `init` / `redirects_updated`), auth tokens, and normal extension preferences. Those are not “serve creative caches.”
- **SSE invalidation:** On `ads_updated` / `notifications_updated`, assume previously returned creatives may be stale; the next `serve` for an eligible visit is authoritative.

Send the end-user **browser user agent on the `User-Agent` request header** (standard for HTTP clients). Do **not** put user agent in the JSON body — the body is strict and only allows `domain` and optional `type`.

```
POST /api/extension/serve
Authorization: Bearer <token>
Content-Type: application/json
User-Agent: Mozilla/5.0 ...

{
  "domain": "instagram.com",
  "type": "notification"            // optional: "ads" | "popup" | "notification" — omit to return all three
}
```

Response `200`:

The server writes one **`enduser_events` row per creative returned** (`type`: `ad`, `popup`, or `notification`) using the request domain and campaign id, so the dashboard reflects serves without relying on the extension to report them. Optional `type` in the request body only affects which buckets are populated; empty buckets are `[]`.

**Targeting and caps are server-only:** Do not expect `targetAudience`, `platformIds`, `countryCodes`, `frequencyType`, schedule fields, or similar on each item — only qualifying rows are returned. **Redirects** are not in this response; they are delivered over SSE (`init.redirects`, `redirects_updated`, etc.) and still include per-rule cap metadata (`frequencyType`, `frequencyCount`, `count`) because the client applies those rules without calling `serve` on each navigation.

```jsonc
{
  "ads": [
    {
      "id": "<uuid>",
      "ad": {
        "title": "...",
        "image": "https://...",
        "description": "...",
        "redirectUrl": "https://...",
        "htmlCode": null,
        "displayAs": "inline"
      }
    }
  ],
  "popups": [
    {
      "id": "<uuid>",
      "ad": {
        "title": "...",
        "image": "https://...",
        "description": "...",
        "redirectUrl": "https://...",
        "htmlCode": null,
        "displayAs": "popup"
      }
    }
  ],
  "notifications": [
    {
      "id": "<uuid>",
      "notification": {
        "title": "...",
        "message": "...",
        "ctaLink": "https://..." // or null
      }
    }
  ]
}
```

You may still use `POST /api/extension/events` with `type: "notification"` for client-side milestones (e.g. user dismissed the toast). That can duplicate counts with the serve-time row if you send both for the same impression—prefer one source per metric.

---

## Redirect rules (SSE only)

Qualifying redirect rows are **only** on the live stream: `init.redirects`, the full list again on `redirects_updated`, and optional single-rule patches on `campaign_updated`. There is **no** dedicated HTTP route for redirect rules—only these SSE payloads. Unlike `POST /api/extension/serve`, each redirect item includes **`frequencyType`**, **`frequencyCount`**, and **`count`** so the extension can enforce caps locally while matching the hostname without a round-trip.

Match the visited hostname locally with `new RegExp(domain_regex, 'i')` and navigate immediately when matched. Do **not** wait for a server round-trip before navigating.

---

## Batch event reporting — `POST /api/extension/events`

Report user activity in batches. **Do not** call this per-event — queue locally and flush.

### Flush policy (client-side)

Flush when **either** condition is met:

- The queue reaches **10 or more events**.
- The oldest queued event is **~60 seconds old**.

Use `keepalive: true` on `fetch` so reports sent just before a navigation are not dropped.

```
POST /api/extension/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": [
    { "type": "visit", "domain": "instagram.com" },
    { "type": "visit", "domain": "facebook.com", "visitedAt": "2026-04-16T10:00:00.000Z" },
    { "type": "redirect", "campaignId": "<uuid>", "domain": "instagram.com" },
    { "type": "notification", "campaignId": "<uuid>", "domain": "facebook.com" }
  ]
}
```

#### Event types


| `type`         | Required fields        | Optional               | Notes                                                                      |
| -------------- | ---------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `visit`        | `domain`               | `visitedAt` (ISO 8601) | No campaign required. `visitedAt` lets you flush with accurate timestamps. |
| `redirect`     | `campaignId`, `domain` | —                      | Campaign must be active and have `campaignType: "redirect"`.               |
| `notification` | `campaignId`, `domain` | —                      | Campaign must be active and have `campaignType: "notification"`.           |


> Do not send `ad` or `popup` as `events` types — use `visit`, `redirect`, and `notification` only.

#### Server limits

- Maximum **100 events** per request (safety cap — extension should stay well under this).
- Campaign events for unknown or mismatched campaigns are silently skipped (counted in `skipped`).

Response `200`:

```json
{ "ok": true, "inserted": 8, "skipped": 1 }
```

---

## Removed endpoints


| Endpoint                       | Replacement                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `GET /api/extension/domains`   | Use `init.domains` from SSE; update on `platforms_updated`. |
| `POST /api/extension/ad-block` | Use SSE `live` (`init` / `redirects_updated`), `POST /api/extension/serve`, and `events`. |
| `POST /api/extension/serve/ads` | **Removed.** Use `POST /api/extension/serve` (optional `type`). |


---

## End-to-end flow summary

```
Extension starts
  → POST /auth/register (or /auth/login)
  → GET /api/extension/live?token=...   (SSE)
      ← event: init { user, domains, redirects }
          • cache domains (for serve-on-visit decisions)
          • apply redirect rules from redirects[]

On each navigation to host H
  if H matches any domain in cache
    → POST /api/extension/serve { domain: H }   // optional type: ads | popup | notification
        ← { ads: [...] }   (inline/popup entries have ad.displayAs; notifications have notification)
  if H matches any redirect rule regex
    → navigate immediately
    → queue event: { type: "redirect", campaignId, domain: H }

When showing a notification (from serve response)
  → queue event: { type: "notification", campaignId, domain: H }

On every page visit
  → queue event: { type: "visit", domain: H }

When queue ≥10 events OR oldest event ≥60 s old
  → POST /events { events: [...] }   (keepalive: true)

On SSE platforms_updated { domains }
  → replace cached domains

On SSE redirects_updated { redirects }
  → replace cached redirect rules with the new array

On SSE campaign_updated { domains, redirect?, redirectRemoval? }
  → replace cached domains; if `redirect` is set, patch that rule; if `redirect` is null, drop the rule matching `redirectRemoval.domain_regex`; refresh ad/notification creatives via serve (or existing ads_updated / notifications_updated) as needed
```

