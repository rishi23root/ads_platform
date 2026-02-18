# Extension API — Ad Block & Notifications

Short reference: endpoints, request/response shapes, and cURL. **User ID (`visitorId`) is provided by the extension.** Responses are arrays for ads and notifications.

## How this doc relates to EXTENSION_API_REFERENCE.md

| Document | Use when |
|----------|----------|
| **EXTENSION_AD_BLOCK_API.md** (this file) | You want a compact endpoint cheat sheet: paths, request/response shapes, and cURL. Same API. |
| **EXTENSION_API_REFERENCE.md** | You want the full reference: **recommended extension connection flow**, TypeScript types, error handling, and code examples. Use that doc to integrate the correct endpoints and flow into your extension. |

Both describe the **same API**. For the recommended flow (connect to live SSE → user marked active → pull on first connect → pull on notification event → ad-block on page loads), see **EXTENSION_API_REFERENCE.md**.

---

## Base URL

| Environment | Base URL |
|-------------|---------|
| Local      | `http://localhost:3000` |
| Production | Your deployed dashboard origin (e.g. `https://your-dashboard.example.com`) |

All paths below are relative to this base.

---

## Endpoint 1: Notifications only (no domain)

| | |
|---|---|
| **Method** | `POST` |
| **Path**   | `/api/extension/notifications` |

Fetches **global** notifications this user has not yet pulled. **No domain required** — only `visitorId`.

### Request

- **Headers:** `Content-Type: application/json`
- **Body:** `{ "visitorId": "string" }`

### Response (200 OK)

```json
{
  "notifications": [
    { "title": "Notification Title", "message": "Notification message", "ctaLink": "https://example.com/action" }
  ]
}
```

### cURL

```bash
curl -X POST http://localhost:3000/api/extension/notifications \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123"}'
```

Use this when the extension only needs notifications (e.g. once per day on load). Logs are written with a sentinel domain (`extension`) in `request_logs`.

---

## Endpoint 2: Live (SSE) — real-time notifications and connection count

| | |
|---|---|
| **Method** | `GET` |
| **Path**   | `/api/extension/live` |

Server-Sent Events (SSE) stream. **Connect here first** so the user is marked **live/active** (Redis is updated; the dashboard shows the connection count via its own SSE). When the admin creates or updates a notification, you receive a `notification` event; **on that event** call `POST /api/extension/notifications` to **pull** and show the new notifications. Optional query param `visitorId`.

### Request

- **URL:** `GET {BASE_URL}/api/extension/live` (optional: `?visitorId=...`)
- **Headers:** None required. Browser `EventSource` sends `Accept: text/event-stream` automatically.

### Response

- **Content-Type:** `text/event-stream`
- **Events:**

| Event              | Description |
|--------------------|-------------|
| `connection_count` | Sent once when you connect. `data` is the current number of connected clients (string number). |
| `notification`     | Sent when the admin creates or updates a notification. `data` is a JSON string. |

### Notification event data (JSON)

When `event` is `notification`, `data` is a JSON string with shape:

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

The connection may close after a **platform timeout** (e.g. ~5 minutes on serverless). The extension should **reconnect** when the stream ends or errors:

- Listen for `error` and `close` on the `EventSource`.
- Reopen the connection (e.g. create a new `EventSource` to the same URL) after a short delay. Optional: use exponential backoff for repeated failures.

### Example (extension)

```javascript
const baseUrl = 'https://your-dashboard.example.com';
const visitorId = 'user-stable-id-abc';
const url = baseUrl + '/api/extension/live?visitorId=' + encodeURIComponent(visitorId);
const es = new EventSource(url);

// On notification event: pull and show (read state recorded via pull)
es.addEventListener('notification', async () => {
  const res = await fetch(baseUrl + '/api/extension/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });
  const { notifications } = await res.json();
  notifications.forEach((n) => showNotificationBanner(n.title, n.message));
});

es.addEventListener('connection_count', (e) => {
  const count = parseInt(e.data, 10);
  // Optional: display or log count
});

es.onerror = () => {
  es.close();
  setTimeout(() => connectLive(), 2000);
};
```

**Flow:** Connect to live (user becomes active; count reflected on dashboard) → on first connect pull `POST /api/extension/notifications` → on `notification` event pull again and show → use ad-block on page loads. See **EXTENSION_API_REFERENCE.md** for the full recommended connection flow.

---

## Endpoint 3: Fetch Ads and/or Notifications

| | |
|---|---|
| **Method** | `POST` |
| **Path**   | `/api/extension/ad-block` |

Fetches ads for the current domain and/or global notifications (pull). the user has not yet “pulled”. Automatically logs visits. **Always returns JSON with `ads` and `notifications` arrays** (one may be empty depending on `requestType`).

---

## Request

### Headers

| Header         | Value              | Required |
|----------------|--------------------|----------|
| `Content-Type` | `application/json` | Yes      |

### Body (JSON)

| Field         | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `visitorId`   | string | Yes      | **Provided by the extension.** Stable anonymous user ID (e.g. generated once, stored in extension storage). Used for analytics and to track which notifications this user has already received. |
| `domain`      | string | Yes      | Domain where the request originated (e.g. page hostname). Used for ads (domain-specific) and logging. Normalized: `instagram.com`, `www.instagram.com`, `https://www.instagram.com/` all resolve. |
| `requestType` | string | No       | `"ad"` \| `"notification"`. If omitted, returns both ads and notifications and logs both. |

### Example bodies

**Both ads and notifications (e.g. initial load):**
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

**Notifications only (e.g. once per day when extension loads):**
```json
{
  "visitorId": "user-stable-id-abc",
  "domain": "instagram.com",
  "requestType": "notification"
}
```

---

## Response (200 OK)

**Shape:** Both `ads` and `notifications` are always present and are **arrays**. Use them directly in extension code.

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

### Response rules

- **`ads`**: Array of ad objects for the requested `domain` (platform resolved via domain). Each ad has `displayAs`: `"inline"` (simple ad) or `"popup"` (show as popup). Empty array if domain has no active ads or domain is not configured.
- **`notifications`**: Array of **global** notifications this user has **not** already pulled. Each notification is returned only once per user (tracked by `visitorId`). Empty array if none or all already shown.
- If `requestType` is `"ad"`, `notifications` is `[]`.
- If `requestType` is `"notification"`, `ads` is `[]`.
- If `requestType` is omitted, both arrays may contain items.

### Ad rendering behavior

| `displayAs` | Behavior |
|-------------|----------|
| **`inline`** | Inject ad content into the page. If `htmlCode` exists, insert that HTML directly. Otherwise use `title`, `image`, `description`, `redirectUrl`. |
| **`popup`** | Create a **modal** and render the ad inside it. If `htmlCode` exists, insert that HTML into the modal. Otherwise use `title`, `image`, `description`, `redirectUrl`. |

### TypeScript types (for extension)

```ts
// Response type — use when parsing JSON
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
```

---

## Errors

| Status | Condition | Message / behavior |
|--------|-----------|--------------------|
| 400    | Missing/invalid `Content-Type` | `"Content-Type must be application/json"` |
| 400    | Invalid JSON body              | `"Invalid JSON in request body"` + details |
| 400    | Missing `visitorId` or `domain` | `"visitorId and domain are required"` |
| 400    | Invalid `requestType`          | `"requestType must be either \"ad\" or \"notification\""` |
| 500    | Server/database error          | `"Failed to fetch ad block"` — retry with backoff |

---

## Extension usage

### User ID (`visitorId`)

- **Provided by the extension.** Generate a stable anonymous ID once (e.g. UUID or hash) and store it (e.g. in `chrome.storage` or equivalent). Reuse the same value for all requests so the backend can:
  - Count requests and last seen per user.
  - Return only **notifications this user has not yet pulled** (each notification is shown once per user).

### Ads

- Call with the **current page domain** (e.g. from `new URL(tab.url).hostname`).
- Response **`ads`** is an array; iterate and render (e.g. replace ad slots).
- Can be called on each page load or when the user navigates to a configured domain.

### Notifications

- **Global:** Notifications are not tied to a domain.
- **Dedicated endpoint:** Use **`POST /api/extension/notifications`** with body `{ "visitorId": "..." }` only — no domain. Best for “notifications only” (e.g. once per day when the extension loads).
- **Alternative:** Use ad-block with `requestType: "notification"` and any domain if you want both ads and notifications from one endpoint.
- **Once per user:** Each notification is returned only until the user has “pulled” it (tracked by `visitorId`).
- **Real-time push:** For instant delivery when the admin creates or updates a notification, connect to **`GET /api/extension/live`** (SSE). See Endpoint 2 above.

### Request type

- Omit `requestType`: get both ads and notifications (good for a single “full” fetch).
- `requestType: "ad"`: only ads (e.g. on every domain page load).
- `requestType: "notification"`: only notifications (e.g. once per day on extension load).

### CORS

If the extension calls the API from a content script or non-extension context, ensure the dashboard allows the extension’s origin in CORS.

---

## Visit logging (automatic)

The endpoint automatically:

- Upserts `extension_users` by `visitorId` (updates `lastSeenAt`, increments `totalRequests`).
- Inserts into `request_logs` (one row per type when both are requested).

No separate “log” call is required.

---

## cURL examples

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

**Notifications only (via ad-block, requires domain):**
```bash
curl -X POST http://localhost:3000/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123","domain":"instagram.com","requestType":"notification"}'
```

**Notifications only (no domain — use dedicated endpoint):**
```bash
curl -X POST http://localhost:3000/api/extension/notifications \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123"}'
```

Replace `http://localhost:3000` with your dashboard base URL for staging/production.
