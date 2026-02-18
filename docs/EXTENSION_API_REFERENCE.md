# Extension API Reference

Complete API reference for browser extensions. All endpoints return data in **array format** for easy iteration. **User ID (`visitorId`) is provided by the extension.**

## How this doc relates to EXTENSION_AD_BLOCK_API.md

| Document | Use when |
|----------|----------|
| **EXTENSION_API_REFERENCE.md** (this file) | You want the full reference: all endpoints, TypeScript types, error handling, code examples, and the **recommended connection flow**. Use this to wire your extension end-to-end with the correct endpoints. |
| **EXTENSION_AD_BLOCK_API.md** | You want a shorter, endpoint-focused cheat sheet (request/response shapes, cURL). Same endpoints; less narrative and no flow section. |

Both describe the **same API**; this doc adds flow, types, and examples so you can integrate into your extension correctly.

---

## Table of Contents

1. [Base URL](#base-url)
2. [Recommended extension connection flow](#recommended-extension-connection-flow)
3. [Endpoints Overview](#endpoints-overview)
4. [Endpoint 0: Active Domains (list)](#endpoint-0-active-domains-list)
5. [Endpoint 1: Ads and/or Notifications (pull)](#endpoint-1-ads-andor-notifications-pull)
6. [Endpoint 2: Live (SSE) — real-time push](#endpoint-2-live-sse--real-time-push)
7. [TypeScript Types](#typescript-types)
8. [Error Handling](#error-handling)
9. [Code Examples](#code-examples)
10. [Best Practices](#best-practices)

---

## Base URL

| Environment | Base URL |
|-------------|---------|
| Local      | `http://localhost:3000` |
| Production | Your deployed dashboard origin (e.g. `https://your-dashboard.example.com`) |

All paths below are relative to this base.

---

## Recommended extension connection flow

Use this flow so users are marked **live**, the dashboard shows the right **connection count**, and users get **new notifications** as soon as the admin creates them.

1. **Connect to the live SSE endpoint**  
   Open `GET {BASE_URL}/api/extension/live` (e.g. with `EventSource`). This marks the user as **live and active**: the backend updates Redis, and the **dashboard** shows the updated connection count via its own SSE stream. Keep this connection open while the extension is active.

2. **Extension load: pull any existing notifications**  
   When the extension loads, call `POST {BASE_URL}/api/extension/ad-block` with `{ visitorId, requestType: "notification" }`. No domain needed. Show any returned notifications from the `notifications` array. This covers notifications created while the user was offline.

3. **Normal browsing**  
   On page load or when the user visits different websites, call `POST {BASE_URL}/api/extension/ad-block` with `visitorId` and `domain` (and optional `requestType`) for ads and visit logging. Extension works as usual.

4. **Stay connected to the live endpoint**  
   As long as the user has the extension active, keep the connection to `GET /api/extension/live` open (reconnect on close or error).

5. **When admin creates a new notification**  
   The backend publishes to Redis and sends an event over the **same** live SSE connection. When the extension receives that **notification** event, it should **pull** the new notifications by calling `POST {BASE_URL}/api/extension/ad-block` with `{ visitorId, requestType: "notification" }`, then **show** the returned notifications. No domain needed. Read state is recorded only when you pull.

**Summary:** Connect to live SSE (user becomes live, count reflected on dashboard) → pull notifications on first connect → use ad-block on page loads → on notification SSE event, pull and show. Use the endpoints below for each step.

---

## Endpoints Overview

| Endpoint | Method | Purpose | Domain Required | Auth |
|----------|--------|---------|-----------------|------|
| `/api/extension/domains` | GET | **List** all active target domains | ❌ No | ❌ No |
| `/api/extension/ad-block` | POST | **Pull** ads and/or notifications | For ads only | ❌ No |
| `/api/extension/live` | GET | **Push** real-time notifications + connection count (SSE) | ❌ No | ❌ No |

**Important:** All extension endpoints above are **public** (no authentication). Do **not** use `/api/notifications` — that is the admin dashboard API and requires an authenticated session. For notifications on extension load, use `POST /api/extension/ad-block` with `requestType: "notification"`.

**Quick decision:**
- **List active domains** → `GET /api/extension/domains` (no auth; returns `{ domains: [...] }`)
- **Pull notifications only** → `POST /api/extension/ad-block` with `requestType: "notification"`
- **Pull ads only** → `POST /api/extension/ad-block` with `requestType: "ad"`
- **Pull both** → `POST /api/extension/ad-block` (omit `requestType`)
- **Push notifications (real-time)** → `GET /api/extension/live` (SSE stream; reconnect on close)

---

## Endpoint 0: Active Domains (list)

**Public GET** – returns all active target domains where the extension will load ads and notifications. Use this to know which domains to make ad-block requests for (e.g. avoid calling ad-block on every domain).

### Request

**URL:** `GET {BASE_URL}/api/extension/domains`

No body or headers required.

### Response (200 OK)

```json
{
  "domains": ["instagram.com", "youtube.com", "example.com"]
}
```

**Response rules:**
- `domains` is always an **array** of strings (hostnames)
- Only includes domains from **active** platforms (`is_active = true`)
- Domains are normalized (e.g. `www.instagram.com` → `instagram.com`)
- Empty array `[]` if no active platforms

### cURL

```bash
curl http://localhost:3000/api/extension/domains
```

---

## Endpoint 1: Ads and/or Notifications (pull)

**Pull** = you request with optional `domain` and `requestType`; server responds with ads and/or notifications. For notifications only, `domain` is not needed.

### Request

**URL:** `POST {BASE_URL}/api/extension/ad-block`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "visitorId": "string",
  "domain": "string",
  "requestType": "ad" | "notification"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `visitorId` | string | Yes | Stable anonymous user ID provided by the extension |
| `domain` | string | For ads | Domain where request originated. **Required when requesting ads**; omit when `requestType: "notification"` only. Normalized: `instagram.com`, `www.instagram.com`, etc. |
| `requestType` | string | No | `"ad"` \| `"notification"`. If omitted, returns both (domain required) |

### Response (200 OK)

```json
{
  "ads": [
    {
      "title": "Ad Title",
      "image": "https://example.com/image.jpg",
      "description": "Ad description",
      "redirectUrl": "https://example.com/target",
      "htmlCode": null,
      "displayAs": "inline"
    }
  ],
  "notifications": [
    {
      "title": "Notification Title",
      "message": "Notification message",
      "ctaLink": "https://example.com/action"
    }
  ]
}
```

**Response rules:**
- Both `ads` and `notifications` are always **arrays** (one may be empty)
- **`ads`**: Array for the requested `domain` (platform resolved via domain). Each ad has `displayAs`: `"inline"` (simple ad) or `"popup"` (show as popup). Empty if domain has no active ads or domain is not configured
- **`notifications`**: Array of **global** notifications this user has **not** already pulled. Empty if none or all already shown
- If `requestType: "ad"` → `notifications` is `[]`
- If `requestType: "notification"` → `ads` is `[]`
- If `requestType` omitted → both arrays may contain items

### Ad rendering behavior

How to render each ad based on `displayAs`:

| `displayAs` | Behavior |
|-------------|----------|
| **`inline`** | Inject the ad content directly into the page. If `htmlCode` is present, insert that HTML into the page as-is. Otherwise, render using `title`, `image`, `description`, `redirectUrl`. |
| **`popup`** | Create a **modal** (overlay) and render the ad inside it. If `htmlCode` is present, insert that HTML into the modal body. Otherwise, render using `title`, `image`, `description`, `redirectUrl`. |

**Notifications** are always shown as banners/toasts (title + message + optional ctaLink). Use a modal or inline banner per your UX.

### Request Examples

**Both ads and notifications:**
```json
{
  "visitorId": "user-stable-id-abc",
  "domain": "instagram.com"
}
```

**Ads only:**
```json
{
  "visitorId": "user-stable-id-abc",
  "domain": "instagram.com",
  "requestType": "ad"
}
```

**Notifications only (on extension load — no domain needed):**
```json
{
  "visitorId": "user-stable-id-abc",
  "requestType": "notification"
}
```

### cURL Examples

**Both ads and notifications:**
```bash
curl -X POST http://localhost:3000/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123","domain":"instagram.com"}'
```

**Ads only:**
```bash
curl -X POST http://localhost:3000/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123","domain":"instagram.com","requestType":"ad"}'
```

**Notifications only (on extension load — no domain needed):**
```bash
curl -X POST https://test.buildyourresume.in/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"visitor-22","requestType":"notification"}'
```
Returns `{ ads: [], notifications: [...] }`. Call this when the extension loads to fetch notifications only.

### When to Use

- **Ads**: On every page load or when user navigates to a configured domain
- **Both**: Initial page load when you need both ads and notifications
- **Notifications on extension load**: Call `POST /api/extension/ad-block` with `{ visitorId, requestType: "notification" }` when the extension loads to get notifications only. No domain needed. Returns `{ ads: [], notifications: [...] }`

---

## Endpoint 2: Live (SSE) — real-time push

**Push** = you open a long-lived **Server-Sent Events (SSE)** connection; the server pushes events when the admin creates or updates a notification, or when platforms (domains) are changed (via Redis). You also receive the current **connection count** when you connect. Use for instant delivery of new notifications and domain updates without polling.

### Request

**URL:** `GET {BASE_URL}/api/extension/live`

**Optional query:** `?visitorId=...` (for future use; not required)

**Headers:** None required. Browser `EventSource` sends `Accept: text/event-stream` automatically.

### Response

- **Content-Type:** `text/event-stream`
- **Connection:** Long-lived; may close after platform timeout (e.g. ~5 minutes). Reconnect when closed or on error.

### Events

| Event | When | Data |
|-------|------|------|
| `connection_count` | Once when you connect | Current number of connected clients (string number). User is now counted as live (dashboard updates). |
| `notification` | When admin creates or updates a notification | JSON string (see below). **On this event, call `POST /api/extension/ad-block` with `{ visitorId, requestType: "notification" }` to pull and show. No domain needed.** |
| `domains` | When admin creates, updates, or deletes a platform | JSON `{"type":"platforms_updated"}`. **On this event, call `GET /api/extension/domains` to refresh your internal domains list.** |

### Notification event payload (JSON)

When `event` is `notification`, `data` may contain notification details. Regardless, **on receiving this event** call `POST /api/extension/ad-block` with `{ visitorId, requestType: "notification" }` to pull and show. No domain needed. Read state is recorded only via the pull API. Optional: `data` as JSON:

```json
{
  "type": "new" | "updated",
  "id": "uuid",
  "title": "string",
  "message": "string",
  "startDate": "ISO8601",
  "endDate": "ISO8601"
}
```

### Reconnection

The stream may close after a **platform timeout** (e.g. ~5 minutes). Reconnect when the stream ends or errors:

- Listen for `error` and `close` on the `EventSource`
- Open a new `EventSource` to the same URL after a short delay (optional: exponential backoff)

### When to Use

- **Mark user as live**: Connecting to this endpoint updates Redis so the dashboard shows this user in the connection count (via its own SSE).
- **Instant notification signal**: When the admin creates or updates a notification, you receive a `notification` event. On that event, call `POST /api/extension/ad-block` with `requestType: "notification"` to **pull** the new notifications and show them; read state is recorded only via the pull API.
- **Instant domains update**: When the admin creates, updates, or deletes a platform, you receive a `domains` event. On that event, call `GET /api/extension/domains` to refresh your internal domains list.
- **Connection count**: You receive `connection_count` once when you connect (optional to display).
- See [Recommended extension connection flow](#recommended-extension-connection-flow) for the full sequence.

### cURL (testing)

SSE is not well suited to cURL (streaming). Use an EventSource in the extension or a browser console.

---

## TypeScript Types

Use these types in your extension code:

```typescript
// Notifications endpoint response (both /notifications and ad-block)
interface NotificationsResponse {
  notifications: Array<{
    title: string;
    message: string;
    ctaLink?: string | null;
  }>;
}

// Ad-block endpoint response
interface AdBlockResponse {
  ads: Array<{
    title: string;
    image: string | null;
    description: string | null;
    redirectUrl: string | null;
    htmlCode?: string | null;
    displayAs?: 'inline' | 'popup';
  }>;
  notifications: Array<{
    title: string;
    message: string;
    ctaLink?: string | null;
  }>;
}

// Request body for ad-block
interface AdBlockRequest {
  visitorId: string;
  domain: string;
  requestType?: 'ad' | 'notification';
}

// Request body for notifications
interface NotificationsRequest {
  visitorId: string;
}

// Live (SSE) — notification event data (parse JSON from event.data)
interface LiveNotificationEvent {
  type: 'new' | 'updated';
  id: string;
  title: string;
  message: string;
  startDate: string; // ISO8601
  endDate: string;   // ISO8601
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

### Error Codes

| Status | Condition | Error Message |
|--------|-----------|---------------|
| 400 | Missing/invalid `Content-Type` | `"Content-Type must be application/json"` |
| 400 | Invalid JSON body | `"Invalid JSON in request body"` + details |
| 400 | Missing `visitorId` | `"visitorId is required"` |
| 400 | Missing `domain` when requesting ads | `"domain is required when requesting ads"` |
| 400 | Invalid `requestType` | `"requestType must be either \"ad\" or \"notification\""` |
| 500 | Server/database error | `"Failed to fetch ad block"` |

### Error Handling Example

```typescript
async function fetchNotifications(visitorId: string): Promise<NotificationsResponse> {
  const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, requestType: 'notification' }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return { notifications: data.notifications };
}
```

---

## Code Examples

### JavaScript/TypeScript: Fetch Notifications

```typescript
const BASE_URL = 'https://your-dashboard.example.com';

async function getNotifications(visitorId: string) {
  const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, requestType: 'notification' }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch notifications');
  }

  const data = await res.json() as NotificationsResponse;
  return data.notifications; // Array of { title, message }
}

// Usage
const notifications = await getNotifications('user-stable-id-abc');
notifications.forEach((n) => {
  console.log(n.title, n.message);
  // Show banner/toast: n.title, n.message
});
```

### JavaScript/TypeScript: Fetch Ads

```typescript
async function getAds(visitorId: string, domain: string) {
  const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId,
      domain,
      requestType: 'ad',
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch ads');
  }

  const data = await res.json() as AdBlockResponse;
  return data.ads; // Array of { title, image, description, redirectUrl }
}

// Usage
const ads = await getAds('user-stable-id-abc', window.location.hostname);
ads.forEach((ad) => {
  console.log(ad.title, ad.image, ad.description, ad.redirectUrl);
  // Render ad slot: image, title, link to redirectUrl
});
```

### JavaScript/TypeScript: Fetch Both

```typescript
async function getAdsAndNotifications(visitorId: string, domain: string) {
  const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, domain }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch');
  }

  return res.json() as Promise<AdBlockResponse>;
}

// Usage
const { ads, notifications } = await getAdsAndNotifications(
  'user-stable-id-abc',
  window.location.hostname
);

// Use ads
ads.forEach((ad) => {
  renderAdSlot(ad);
});

// Use notifications
notifications.forEach((n) => {
  showNotificationBanner(n.title, n.message);
});
```

### JavaScript/TypeScript: Live (SSE) — connect, then pull on notification event

```typescript
const BASE_URL = 'https://your-dashboard.example.com';

function connectLive(visitorId: string) {
  const url = `${BASE_URL}/api/extension/live?visitorId=${encodeURIComponent(visitorId)}`;
  const es = new EventSource(url);

  // On notification event: pull and show (read state recorded via pull)
  es.addEventListener('notification', async () => {
    const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, requestType: 'notification' }),
    });
    if (!res.ok) return;
    const { notifications } = (await res.json()) as NotificationsResponse;
    notifications.forEach((n) => showNotificationBanner(n.title, n.message));
  });

  es.addEventListener('connection_count', (e: MessageEvent) => {
    const count = parseInt(e.data, 10);
    console.log('Connected users:', count); // optional
  });

  es.onerror = () => {
    es.close();
    setTimeout(() => connectLive(visitorId), 2000);
  };

  return es;
}

// Usage: call when extension loads; optionally pull existing notifications first
const visitorId = 'user-stable-id-abc';
connectLive(visitorId);
// Optional: pull any existing unread notifications on extension load
fetch(`${BASE_URL}/api/extension/ad-block`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visitorId, requestType: 'notification' }),
}).then((r) => r.json()).then((d) => d.notifications.forEach((n: { title: string; message: string }) => showNotificationBanner(n.title, n.message)));
```

### Vanilla JavaScript (No TypeScript)

```javascript
// Notifications (on extension load — no domain needed)
const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visitorId: 'my-user-id', requestType: 'notification' }),
});
const { notifications } = await res.json();
notifications.forEach((n) => {
  console.log(n.title, n.message);
});

// Ads
const res2 = await fetch(`${BASE_URL}/api/extension/ad-block`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    visitorId: 'my-user-id',
    domain: window.location.hostname,
    requestType: 'ad',
  }),
});
const { ads } = await res2.json();
ads.forEach((ad) => {
  console.log(ad.title, ad.image, ad.description, ad.redirectUrl);
});
```

---

## Best Practices

### User ID (`visitorId`)

- **Generate once** (e.g. UUID or hash) and store in extension storage (`chrome.storage`, `browser.storage`, etc.)
- **Reuse the same value** for all requests
- Used for:
  - Analytics (request counts, last seen)
  - Per-user notification tracking (each notification shown once per user)

### Notifications

- **Connect to live first:** Open **`GET /api/extension/live`** so the user is counted as live/active (Redis updated; dashboard shows count via its own SSE). Keep this connection open while the extension is active; reconnect on close or error.
- **Extension load:** Call **`POST /api/extension/ad-block`** with `{ visitorId, requestType: "notification" }` when the extension loads to get any existing unread notifications and show them. No domain needed.
- **On notification event:** When you receive a `notification` event on the live SSE stream, call **`POST /api/extension/ad-block`** with `{ visitorId, requestType: "notification" }` again to **pull** the new notifications and show them. No domain needed. Read state is recorded only when you pull.
- Each notification is returned only until the user has pulled it; after that it won't appear again for that user.

### Ads

- **Call on page load** or when user navigates to a configured domain
- Use **`/api/extension/ad-block`** with `requestType: "ad"`
- Domain is normalized automatically (e.g. `instagram.com`, `www.instagram.com`, `https://www.instagram.com/` all work)
- Empty array if domain has no active ads or domain is not configured

### Caching

- **Cache ad responses** by domain (e.g. 5–15 minutes TTL) to avoid refetching on every page load
- **Don't cache notifications** — call once per day to get new ones
- Invalidate cache when user explicitly refreshes or extension updates

### Error Handling

- Always check `res.ok` before parsing JSON
- Handle 400 errors (validation) differently from 500 errors (server issues)
- Retry 500 errors with exponential backoff
- Log errors for debugging

### CORS

If calling from a content script or non-extension context, ensure the dashboard allows your extension's origin in CORS headers.

### Automatic Logging

Both endpoints automatically:
- Upsert `extension_users` by `visitorId` (updates `lastSeenAt`, increments `totalRequests`)
- Insert into `request_logs` for analytics

**No separate "log" call is required.**

---

## Summary

| Endpoint | Use Case | Domain Required | Response / Behavior |
|----------|----------|-----------------|---------------------|
| `POST /api/extension/ad-block` | **Pull** notifications only (e.g. on extension load) | ✅ Yes | `{ ads: [], notifications: [...] }` |
| `POST /api/extension/ad-block` | **Pull** ads only | ✅ Yes | `{ ads: [...], notifications: [] }` |
| `POST /api/extension/ad-block` | **Pull** both ads and notifications | ✅ Yes | `{ ads: [...], notifications: [...] }` |
| `POST /api/extension/ad-block` | **Pull** notifications via ad-block | ✅ Yes | `{ ads: [], notifications: [...] }` |
| `GET /api/extension/live` | **Push** real-time notifications (SSE) | ❌ No | Stream: `connection_count`, `notification` events |

**Pull:** request/response; **Push:** SSE stream (Redis-backed events). Pull responses use **arrays** — iterate directly in your extension code.
