# Extension API Documentation

## v2 (recommended)

Use **[EXTENSION_V2_API.md](./EXTENSION_V2_API.md)** for the current architecture:

- **`GET /api/extension/live`** — SSE: `init` payload (`platforms`, `campaigns`, `frequencyCounts`, …) + realtime updates (requires **Bearer** or **`?token=`**).
- **`POST /api/extension/serve/ads`** — per-visit **ads, popups**, and **server-matched redirects** (Bearer); logs `ad` / `popup` / `redirect` (or `request` if nothing served). Does **not** log **`visit`**.
- **`POST /api/extension/events`** — client-reported **`visit`** (batched 5–10 per flush, optional `visitedAt`), **notification**, and **redirect** (client-only deliveries) (Bearer).
- Legacy **`POST /api/extension/ad-block`** — unchanged; still supported.

**Authentication:** Extension end users use **`POST /api/extension/auth/register`** and **`POST /api/extension/auth/login`**, then **`Authorization: Bearer <token>`** on REST routes. **`GET /api/extension/domains`** remains public (optional; v2 `init` includes domain data).

Do **not** use `/api/notifications` (admin UI / Better Auth) for the extension.

---

## Legacy: single ad-block endpoint

This document below focuses on **`POST /api/extension/ad-block`** — fetch ads and/or notifications with automatic visit logging.

**Base URL:** `https://your-admin-dashboard-domain.com` (paths are relative, e.g. `/api/extension/ad-block`)

> **Note**: Older references to [EXTENSION_API_REFERENCE.md](./EXTENSION_API_REFERENCE.md) / [EXTENSION_AD_BLOCK_API.md](./EXTENSION_AD_BLOCK_API.md) may be stale; prefer **EXTENSION_V2_API.md** for new work.

**Authentication:** **`POST /api/extension/ad-block` requires a session token.** End users register and sign in as above, then send `Authorization: Bearer <token>` on ad-block requests.

---

## Table of Contents

1. [Get Ad Block Data and Log Visit (Recommended)](#1-get-ad-block-data-and-log-visit-recommended)
2. [Response Schemas](#response-schemas)
3. [Usage Examples](#usage-examples)
4. [Error Handling](#error-handling)

---

## 1. Get Ad Block Data and Log Visit (Recommended)

**This is the recommended endpoint for extensions.** Fetches ads and/or notifications for a domain and automatically logs the visit(s) for analytics. Replaces the need for separate GET requests and log POST requests.

### Endpoint

```
POST /api/extension/ad-block
```

### Headers

| Header | Required | Value |
|--------|----------|--------|
| `Content-Type` | Yes | `application/json` |
| `Authorization` | Yes | `Bearer <token>` from `POST /api/extension/auth/login` |

### Request Body

```json
{
  "domain": "example.com",
  "requestType": "ad"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | For ads | **Required when requesting ads**; omit when `requestType: "notification"` only. |
| `requestType` | string | No | `"ad"` or `"notification"`. If omitted, returns both (domain required for ads). |
| `userAgent` | string | No | Optional telemetry. |

User id, email, and plan are **not** sent in the body; they come from the `end_users` row tied to the Bearer token.

### Response

**Status Code:** `200 OK`

**Response Body:**

```json
{
  "ads": [
    {
      "title": "Summer Sale Banner",
      "image": "https://cdn.example.com/banner.jpg",
      "description": "Promotional banner for summer sale",
      "redirectUrl": "https://example.com/sale",
      "htmlCode": null,
      "displayAs": "inline"
    }
  ],
  "notifications": [
    {
      "title": "System Maintenance",
      "message": "We will be performing scheduled maintenance on Saturday.",
      "ctaLink": "https://example.com/maintenance"
    }
  ]
}
```

**Notes:**
- Both `ads` and `notifications` arrays are always present, even if empty.
- If `requestType` is `"ad"`, `notifications` will be empty.
- If `requestType` is `"notification"`, `ads` will be empty.
- If `requestType` is omitted, both arrays may contain items.
- Public fields only: no internal IDs, status, or date ranges.

### Visit logging

The server writes **`enduser_events`** rows (and may update **`end_users`** e.g. country from edge headers). There is no separate log endpoint.

### Example Request

```javascript
const BASE_URL = 'https://your-admin-dashboard-domain.com';

// After login: const token = ...
const response = await fetch(`${BASE_URL}/api/extension/ad-block`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    domain: window.location.hostname,
    // requestType omitted = get both
  }),
});

const { ads, notifications } = await response.json();
```

```javascript
// Get ads only
const response = await fetch(`${BASE_URL}/api/extension/ad-block`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    domain: window.location.hostname,
    requestType: 'ad',
  }),
});

const { ads, notifications } = await response.json();
// notifications will be empty array
```

---

---

## 2. Response Schemas

### Ad Block Response Object

```typescript
interface AdBlockResponse {
  ads: PublicAd[];
  notifications: PublicNotification[];
}

interface PublicAd {
  title: string;                 // Ad name/title
  image: string | null;          // URL to ad image/banner
  description: string | null;    // Optional description
  redirectUrl: string | null;   // URL to redirect when ad is clicked
  htmlCode?: string | null;      // Optional HTML content
  displayAs?: 'inline' | 'popup'; // "inline" = simple ad, "popup" = show as popup
}

interface PublicNotification {
  title: string;                 // Notification title
  message: string;               // Notification message/content
  ctaLink?: string | null;       // Optional call-to-action link
}
```

**Note:** The ad-block endpoint returns public fields only (no IDs, status, or date ranges). Visit logging happens automatically and does not appear in the response.

**Ad rendering:** `displayAs: "inline"` → inject `htmlCode` (or image/title/link) into the page. `displayAs: "popup"` → create a modal and render the ad inside it.

---

---

## 3. Usage Examples

### Complete Extension Implementation Example

```javascript
// Configuration
const API_BASE_URL = 'https://your-admin-dashboard-domain.com';

function getCurrentDomain() {
  return window.location.hostname;
}

async function getStoredToken() {
  return localStorage.getItem('extension_auth_token');
}

async function loginAndStoreToken(email, password) {
  const res = await fetch(`${API_BASE_URL}/api/extension/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const { token } = await res.json();
  localStorage.setItem('extension_auth_token', token);
  return token;
}

async function fetchAdBlock(token, requestType) {
  try {
    const domain = getCurrentDomain();
    const body = { domain };
    if (requestType) body.requestType = requestType;

    const response = await fetch(`${API_BASE_URL}/api/extension/ad-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ad block: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching ad block:', error);
    return { ads: [], notifications: [] };
  }
}

async function loadExtensionContent() {
  let token = await getStoredToken();
  if (!token) {
    // Prompt user or open /register — example only:
    token = await loginAndStoreToken('user@example.com', 'password');
  }
  const { ads, notifications } = await fetchAdBlock(token);
  if (ads.length > 0) displayAds(ads);
  if (notifications.length > 0) displayNotifications(notifications);
}

// Display ads in the extension
function displayAds(ads) {
  ads.forEach(ad => {
    if (ad.image && ad.redirectUrl) {
      // Create ad banner/element
      const adElement = document.createElement('div');
      adElement.className = 'extension-ad';
      adElement.innerHTML = `
        <a href="${ad.redirectUrl}" target="_blank">
          <img src="${ad.image}" alt="${ad.title}" />
        </a>
      `;
      // Insert into page or extension UI
    }
  });
}

// Display notifications in the extension
function displayNotifications(notifications) {
  notifications.forEach(notification => {
    // Create notification element
    const notificationElement = document.createElement('div');
    notificationElement.className = 'extension-notification';
    notificationElement.innerHTML = `
      <h3>${notification.title}</h3>
      <p>${notification.message}</p>
    `;
    // Insert into page or extension UI
  });
}

// Initialize extension
loadExtensionContent();
```

### TypeScript Example

```typescript
// Use the PublicAd and PublicNotification types from Response Schemas above.
// The API returns public fields only (no IDs, status, or date ranges).
const API_BASE_URL = 'https://your-admin-dashboard-domain.com';
```

---

## 4. Error Handling

### HTTP Status Codes

| Status Code | Description | Action |
|-------------|-------------|--------|
| `200 OK` | Request successful | Process response data |
| `201 Created` | Resource created (log endpoint) | Continue normally |
| `400 Bad Request` | Invalid request parameters | Check request body/parameters |
| `404 Not Found` | Resource not found | Handle gracefully (empty state) |
| `500 Internal Server Error` | Server error | Log error, retry or show fallback |

### Error Response Format

```json
{
  "error": "Error message describing what went wrong"
}
```

### Example Error Handling

```javascript
async function fetchWithErrorHandling(url) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    // Return empty array or default value
    return [];
  }
}
```

---

## Important Notes

1. **Domain Matching**: The extension should extract the domain from `window.location.hostname` and pass it to the API endpoints.

2. **Date Filtering**: 
   - Ads are filtered by `status: "active"` only
   - Notifications are automatically filtered by date range (`startDate <= now <= endDate`)

3. **Caching**: Consider implementing caching in your extension to reduce API calls:
   - Cache ads/notifications for a short period (e.g., 5-10 minutes)
   - Invalidate cache when user navigates to a new domain

4. **Accounts**: End users register and sign in; store the **session token** securely (not a client-generated `endUserId`).

5. **CORS**: Ensure your admin dashboard CORS settings allow requests from your extension's origin.

---

## Testing

### Test Script

A test script is available to simulate extension pull requests and verify API functionality:

```bash
pnpm test:extension-log
```

Or run directly:

```bash
./docs/test-extension-log.sh
```

The script will:
- Log in with `EXTENSION_EMAIL` / `EXTENSION_PASSWORD` to obtain a Bearer token
- Fetch real platforms from your database
- Call the ad-block endpoint with `Authorization: Bearer`
- Display results and sample curl commands

See [TEST_EXTENSION_LOG.md](./TEST_EXTENSION_LOG.md) for detailed documentation.

---

## Changelog

### 2026-01-27
- Added test script documentation reference
- Updated testing section with test script information

### 2026-02-07
- Consolidated to single `/api/extension/ad-block` endpoint
- Removed separate GET endpoints for extension use
- Automatic visit logging integrated into ad-block endpoint

### 2026-03-25
- **Breaking:** Ad-block requires **`Authorization: Bearer`** (extension user login). Body no longer includes `endUserId` / email / plan. See `EXTENSION_API_REFERENCE.md`.

---

## Support

For issues or questions about the API, please refer to:
- [Test Script Documentation](./TEST_EXTENSION_LOG.md) - Guide for testing the API
- [Extension Ad Block API](./EXTENSION_AD_BLOCK_API.md) - Complete API reference
- [Architecture Documentation](./ARCHITECTURE.md) - System architecture overview
- [Database Documentation](./DATABASE.md) - Database schema details
- See [README.md](./README.md) for documentation overview
