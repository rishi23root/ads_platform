# Extension API Reference

Complete API reference for browser extensions. All endpoints return data in **array format** for easy iteration. **User ID (`visitorId`) is provided by the extension.**

---

## Table of Contents

1. [Base URL](#base-url)
2. [Endpoints Overview](#endpoints-overview)
3. [Endpoint 1: Notifications Only](#endpoint-1-notifications-only)
4. [Endpoint 2: Ads and/or Notifications](#endpoint-2-ads-andor-notifications)
5. [TypeScript Types](#typescript-types)
6. [Error Handling](#error-handling)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)

---

## Base URL

| Environment | Base URL |
|-------------|---------|
| Local      | `http://localhost:3000` |
| Production | Your deployed dashboard origin (e.g. `https://your-dashboard.example.com`) |

All paths below are relative to this base.

---

## Endpoints Overview

| Endpoint | Method | Purpose | Domain Required |
|----------|--------|---------|-----------------|
| `/api/extension/notifications` | POST | Get notifications only | ❌ No |
| `/api/extension/ad-block` | POST | Get ads and/or notifications | ✅ Yes |

**Quick decision:**
- **Notifications only** → Use `/api/extension/notifications` (no domain needed)
- **Ads only** → Use `/api/extension/ad-block` with `requestType: "ad"`
- **Both** → Use `/api/extension/ad-block` (omit `requestType`)

---

## Endpoint 1: Notifications Only

### Request

**URL:** `POST {BASE_URL}/api/extension/notifications`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "visitorId": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `visitorId` | string | Yes | Stable anonymous user ID provided by the extension |

### Response (200 OK)

```json
{
  "notifications": [
    {
      "title": "Notification Title",
      "message": "Notification message"
    }
  ]
}
```

**Response rules:**
- `notifications` is always an **array**
- Returns only **global** notifications this user has **not** already pulled
- Each notification is returned **once per user** (tracked by `visitorId`)
- Empty array `[]` if no new notifications

### cURL

```bash
curl -X POST http://localhost:3000/api/extension/notifications \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123"}'
```

### When to Use

- **Once per day** when the user opens the browser or when the extension loads
- Extension only needs notifications (no ads)
- No domain context available

---

## Endpoint 2: Ads and/or Notifications

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
  "requestType": "ad" | "notification" // optional
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `visitorId` | string | Yes | Stable anonymous user ID provided by the extension |
| `domain` | string | Yes | Domain where request originated (e.g. page hostname). Normalized: `instagram.com`, `www.instagram.com`, `https://www.instagram.com/` all resolve |
| `requestType` | string | No | `"ad"` \| `"notification"`. If omitted, returns both |

### Response (200 OK)

```json
{
  "ads": [
    {
      "title": "Ad Title",
      "image": "https://example.com/image.jpg",
      "description": "Ad description",
      "redirectUrl": "https://example.com/target"
    }
  ],
  "notifications": [
    {
      "title": "Notification Title",
      "message": "Notification message"
    }
  ]
}
```

**Response rules:**
- Both `ads` and `notifications` are always **arrays** (one may be empty)
- **`ads`**: Array for the requested `domain` (platform resolved via domain). Empty if domain has no active ads or domain is not configured
- **`notifications`**: Array of **global** notifications this user has **not** already pulled. Empty if none or all already shown
- If `requestType: "ad"` → `notifications` is `[]`
- If `requestType: "notification"` → `ads` is `[]`
- If `requestType` omitted → both arrays may contain items

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

**Notifications only:**
```json
{
  "visitorId": "user-stable-id-abc",
  "domain": "instagram.com",
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

**Notifications only:**
```bash
curl -X POST http://localhost:3000/api/extension/ad-block \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123","domain":"instagram.com","requestType":"notification"}'
```

### When to Use

- **Ads**: On every page load or when user navigates to a configured domain
- **Both**: Initial page load when you need both ads and notifications
- **Notifications via ad-block**: When you want notifications but also have domain context

---

## TypeScript Types

Use these types in your extension code:

```typescript
// Notifications endpoint response
interface NotificationsResponse {
  notifications: Array<{
    title: string;
    message: string;
  }>;
}

// Ad-block endpoint response
interface AdBlockResponse {
  ads: Array<{
    title: string;
    image: string | null;
    description: string | null;
    redirectUrl: string | null;
  }>;
  notifications: Array<{
    title: string;
    message: string;
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
| 400 | Missing `domain` (ad-block only) | `"visitorId and domain are required"` |
| 400 | Invalid `requestType` | `"requestType must be either \"ad\" or \"notification\""` |
| 500 | Server/database error | `"Failed to fetch notifications"` or `"Failed to fetch ad block"` |

### Error Handling Example

```typescript
async function fetchNotifications(visitorId: string): Promise<NotificationsResponse> {
  const res = await fetch(`${BASE_URL}/api/extension/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<NotificationsResponse>;
}
```

---

## Code Examples

### JavaScript/TypeScript: Fetch Notifications

```typescript
const BASE_URL = 'https://your-dashboard.example.com';

async function getNotifications(visitorId: string) {
  const res = await fetch(`${BASE_URL}/api/extension/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
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

### Vanilla JavaScript (No TypeScript)

```javascript
// Notifications
const res = await fetch(`${BASE_URL}/api/extension/notifications`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visitorId: 'my-user-id' }),
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

- **Call once per day** when the user opens the browser or when the extension loads
- Use **`/api/extension/notifications`** endpoint (no domain needed)
- Each notification is returned only until the user has "pulled" it
- After pulling, it won't appear again for that user

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

| Endpoint | Use Case | Domain Required | Response |
|----------|----------|-----------------|----------|
| `POST /api/extension/notifications` | Notifications only (once per day) | ❌ No | `{ notifications: [...] }` |
| `POST /api/extension/ad-block` | Ads only | ✅ Yes | `{ ads: [...], notifications: [] }` |
| `POST /api/extension/ad-block` | Both ads and notifications | ✅ Yes | `{ ads: [...], notifications: [...] }` |
| `POST /api/extension/ad-block` | Notifications via ad-block | ✅ Yes | `{ ads: [], notifications: [...] }` |

**All responses are arrays** — iterate directly in your extension code.
