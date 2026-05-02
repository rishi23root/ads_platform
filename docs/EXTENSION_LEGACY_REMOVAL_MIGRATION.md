# Extension migration: legacy API removal (handoff for extension / client teams)

> **Historical — not the live contract.** This is a migration handoff for teams updating old clients. The **current** extension API is defined in [`EXTENSION_CLIENT_CONTRACT.md`](./EXTENSION_CLIENT_CONTRACT.md).

This document explains **what the admin dashboard removed**, **why**, and **exactly what the browser extension (or any other client) must do instead**. Share it with the team that owns the extension codebase so they can plan releases and QA.

---

## 1. What was “legacy”?

The legacy integration was a **single HTTP endpoint**:

| Removed | Method & path | Role |
|--------|----------------|------|
| **Legacy ad-block** | `POST /api/extension/ad-block` | One call returned **ads**, **notifications**, and **redirect rules** together. The server could log **`ad`**, **`popup`**, **`notification`**, and **`redirect`** rows in `enduser_events` depending on the response. |

**Auth:** `Authorization: Bearer <token>` (same as today).

**Typical body:**

```json
{ "domain": "www.example.com", "requestType": "ad" }
```

Optional `requestType`: `"ad"` (default behavior) or `"notification"` (notifications-only path; `domain` could be omitted in some setups).

**Typical response shape:**

```json
{
  "ads": [ /* creatives */ ],
  "notifications": [ /* payloads */ ],
  "redirects": [ /* sourceDomain, destinationUrl, includeSubdomains */ ]
}
```

That design was simple for a first version but encouraged **one round-trip per navigation**, mixed concerns, and made **instant redirects** (client-side match + navigate) harder than a prefetch + local match model.

---

## 2. What replaced it? (v2 — the only supported path)

Legacy is **removed** from the server. Clients must use **v2** only:

| Need | Replacement endpoint | Notes |
|------|----------------------|--------|
| User info, campaign-referenced domains, qualifying redirect rules | `GET /api/extension/live` (SSE) | Query: `?token=<bearer>` or streaming `fetch` with `Authorization`. First event: `init` with shape `{ user, domains, redirects }`. Ads and notifications are **not** in `init`; fetch them on-demand. |
| Inline ads, popups & notifications for a visit | `POST /api/extension/serve` | Body: `{ "domain": "<hostname>", "type"?: "ads" \| "popup" \| "notification" }` (strict — no `userAgent` in JSON). Omit `type` to return all three kinds. Send the real UA on the `User-Agent` header. Response: `{ "ads": [], "popups": [], "notifications": [] }` — each item is **`id` + `ad`** or **`id` + `notification`** only (no campaign-level targeting fields; see `EXTENSION_CLIENT_CONTRACT.md`). Server logs matching `enduser_events` rows on each successful serve. |
| Qualifying redirect rules (`domain_regex`, `target_url`, caps) | SSE `init.redirects` and `redirects_updated` | **No dedicated HTTP route** for redirects. The live stream’s first `init` event and each `redirects_updated` event include the full `redirects` array (same shape). Patch single rules via `campaign_updated` when the server includes `redirect`. |
| Visits, client-reported **notification** & **redirect** | `POST /api/extension/events` | Body: `{ "events": [ ... ] }` (max 100 items). Types: `visit`, `notification`, `redirect`. Flush at ≥10 events or ~60 s. |
| ~~Public platform hostnames~~ | ~~`GET /api/extension/domains`~~ | **Removed.** Use `init.domains` from SSE; update on `platforms_updated` event. |
| Auth | `POST .../auth/register`, `login`, `GET .../auth/me`, etc. | Unchanged. |

**Do not** call `POST /api/extension/ad-block`. It should **404** or be absent after removal.

---

## 3. Behavioral differences the extension must implement

### 3.1 Redirects: prefetch → match locally → navigate → then telemetry

- **Before (legacy):** Redirect could appear in the **ad-block JSON**; server might log **`redirect`** when it returned a matching rule.
- **Now:** 1. Hydrate rules from SSE **`init.redirects`** and refresh from **`redirects_updated`** (full list) or **`campaign_updated`** (single-rule patch).  
  2. Match the tab hostname locally (e.g. `domain_regex` from the cached rows).  
  3. **Navigate immediately** when a rule matches (do not wait on HTTP for UX).  
  4. Report with **`POST /api/extension/events`**: `{ "type": "redirect", "campaignId": "<uuid>", "domain": "<pre-redirect hostname>" }`.  
  Use non-blocking `fetch` (e.g. `keepalive: true` from the background context) so navigation is not delayed.

### 3.2 Notifications

- **Before:** Could be fetched via ad-block with `requestType: "notification"`, with server-side logging when returned.
- **Now:** Call **`POST /api/extension/serve`** when a domain in `init.domains` is visited (optional `"type": "notification"` to fetch only notifications). Show the notification when the response contains a `notification`-type campaign. Report the impression with **`POST /api/extension/events`** `type: "notification"` + `campaignId` + `domain`.

### 3.3 Ads / popups

- **Before:** Part of ad-block response; server logged when returned.
- **Now:** **`POST /api/extension/serve`** with the tab **`domain`** returns inline ad, popup, and notification creatives (or a subset via `type`). There is **no** `ad` / `popup` type on `POST /events` — use that endpoint for `visit`, `redirect`, and `notification` only.

### 3.4 Visits

- **Before:** Could be tied to ad-block visit logging depending on product version.
- **Now:** Batch **`type: "visit"`** on **`POST /api/extension/events`** (see your API doc for batch size guidance, e.g. 5–10 domains per flush).

### 3.5 Frequency caps on client-reported events (important)

On backends that align with the post-legacy dashboard:

- **`notification`** and **`redirect`** events are only **inserted** if the campaign still passes the same **schedule, audience, geo, time window, and frequency caps** as the serve endpoints. If over cap or inactive, the server may **skip** the insert **without failing the whole request**.
- The **`POST /api/extension/events`** response may include **`recorded`**: the number of rows actually written in that request. Use it if you need to distinguish “accepted” vs “skipped” for caps.

---

## 4. Quick mapping table (legacy → v2)

| Legacy (`ad-block`) | v2 |
|---------------------|-----|
| One POST per navigation for everything | SSE `live` + targeted POSTs |
| `requestType: "ad"` + `domain` | `POST /api/extension/serve` `{ domain }` (or `"type": "ads"` / `"popup"` as needed) |
| `requestType: "notification"` | `POST /api/extension/serve` `{ "domain", "type": "notification" }` + `POST /events` `notification` for impressions |
| `redirects` in JSON + server log sometimes | SSE `init` / `redirects_updated` + local match + `POST /events` `redirect` |
| Mixed response keys | `serve` → `{ ads, popups, notifications }`; redirects **only** on the SSE live stream |

---

## 5. Extension team checklist (definition of done)

- [ ] Remove every `fetch` / XHR to **`/api/extension/ad-block`** (including fallbacks and feature flags).
- [ ] Implement **`GET /api/extension/live`** (`?token=` or authorized stream). On `init` cache `user`, `domains` (campaign-referenced hostnames), and `redirects` (rewrite rules + caps). Refresh `domains` on `platforms_updated { domains }`. **Do not** call `GET /api/extension/domains` — that endpoint has been removed.
- [ ] On each navigation, if the visited host matches a domain in cached `domains`, call **`POST /api/extension/serve`** (optional `type` filter).
- [ ] Apply redirect rules from `init.redirects` locally (match `domain_regex`) and refresh them when SSE emits `redirects_updated` (replace full list) or `campaign_updated` (patch/remove one rule via `redirect`).
- [ ] **Do not** add a separate HTTP fetch for redirect rules. Cache rules from SSE in memory + extension storage; fire **`events`** for `redirect` without blocking navigation.
- [ ] Implement **`POST /api/extension/serve`** for creatives (or your agreed prefetch + background reconciliation strategy).
- [ ] Implement **`POST /api/extension/events`** for `visit`, `notification`, and `redirect` as required.
- [ ] Update env / build configs so the extension **only** targets API bases that have shipped the removal (no mixed old/new servers without branching).
- [ ] QA: frequency caps, geo, schedule, and “no double logging” (no parallel legacy + v2 calls).

---

## 6. Reference docs in this repo (when present)

- **`docs/EXTENSION_V2_API.md`** — Full v2 contract (auth, SSE, bodies, examples).
- **`docs/EXTENSION_CLIENT_IMPLEMENTATION_CHECKLIST.md`** — Prefetch, latency, and integration checklist (if maintained).
- **`docs/ARCHITECTURE.md`** — High-level API list.

If a doc path is missing in your checkout, use this file plus the route implementations under `src/app/api/extension/`.

---

## 7. One-line summary for PMs / leads

**We removed the combined `POST /api/extension/ad-block` endpoint and `POST /api/extension/serve/ads`; redirect rules never had a supported standalone POST on v2. The extension must use SSE `live` (including `init.redirects` and `redirects_updated`), `POST /api/extension/serve`, and batched `events` only—apply redirects locally for instant navigation and report telemetry on `events`.**

---

*Document purpose: handoff to extension (“client”) engineering after legacy removal on the admin dashboard API.*
