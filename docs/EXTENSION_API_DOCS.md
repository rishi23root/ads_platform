# Extension API Documentation

## v2 (recommended)

Use **[EXTENSION_V2_API.md](./EXTENSION_V2_API.md)** for the current architecture (includes an **[implementation checklist](./EXTENSION_V2_API.md#extension-implementation-checklist)** for extension tasks).

- **`GET /api/extension/live`** — SSE: `init` payload (`platforms`, `campaigns`, `frequencyCounts`, …) + realtime updates (requires **Bearer** or **`?token=`**).
- **`POST /api/extension/serve/redirects`** — Prefetch **redirect** campaigns already filtered by schedule, **frequency/count**, geo, audience, and time-of-day; optional **`domain`** narrows by platform. Each item: **`domain_regex`**, **`target_url`**, **`date_till`**, **`count`**, **`campaignId`**. Does **not** write `enduser_events`; after navigation use **`POST /events`** (`type: "redirect"`).
- **`POST /api/extension/serve/ads`** — per-visit **ads and popups** only (Bearer); logs **`ad`** / **`popup`**. No **`redirects`** key. Does **not** log **`visit`**.
- **`POST /api/extension/events`** — client-reported **`visit`** (batched), **`notification`**, and **`redirect`** (Bearer).
- Legacy **`POST /api/extension/ad-block`** — combined **`ads`**, **`notifications`**, **`redirects`** with server logging for matching serves.

**Authentication:** Extension end users use **`POST /api/extension/auth/register`** and **`POST /api/extension/auth/login`**, then **`Authorization: Bearer <token>`** on REST routes. **`GET /api/extension/domains`** remains public (optional; v2 `init` includes domain data).

- **Anonymous register:** `{ "identifier": "<device id>" }` — **201** on first creation, **200** when that anonymous id already exists (new session). See **EXTENSION_V2_API.md** for full rules.
- **Email register with `identifier`:** upgrades the existing anonymous row in place (**same user id**), when present.
- **Email login:** optional **`identifier`** consolidates an email-only row into the anonymous row (**same UUID**): events/payments and credentials end up on the anonymous id; the duplicate email row is removed.
- **Device id:** generate on install → local storage → reuse on anonymous register, email register, and login. **`user.identifier`** in responses and **`/me`** is the server’s copy—**refresh local storage** when it is non-null so client and backend stay in sync (details in **EXTENSION_V2_API.md**).

Do **not** use `/api/notifications` (admin UI / Better Auth) for the extension.

---

## Legacy: single ad-block endpoint

This document below documents **`POST /api/extension/ad-block`** — fetch ads, notifications, and **redirect rules** with automatic visit / serve logging. **New work should use v2** ([EXTENSION_V2_API.md](./EXTENSION_V2_API.md): SSE + **`serve/redirects`** + **`serve/ads`** + batched **`events`**).

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

## 1. Get Ad Block Data and Log Visit (legacy)

**Legacy only — prefer v2** (`live` + **`serve/redirects`** + `serve/ads` + `events` — see [EXTENSION_V2_API.md](./EXTENSION_V2_API.md)). This endpoint fetches ads, notifications, and **server-selected redirect payloads** for a domain and records matching **`enduser_events`** (including **`redirect`** when a rule matches).

**Redirects are not HTTP 3xx responses.** The API returns JSON with a **`redirects`** array (`sourceDomain`, `includeSubdomains`, `destinationUrl`). The extension **navigates** when the visit hostname matches those fields (same idea as v2 **`serve/redirects`** `domain_regex` + **`target_url`**, documented in **EXTENSION_V2_API.md**).

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
| `requestType` | string | No | `"ad"` or `"notification"`. If omitted, returns ads + notifications + redirects for the domain. With `"ad"` only: **ads, popups, and redirects** (redirects ride the ad channel). With `"notification"` only: notifications only; **`redirects` is `[]`**. |
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
  ],
  "redirects": [
    {
      "sourceDomain": "partner-site.com",
      "includeSubdomains": false,
      "destinationUrl": "https://your-offer.example/landing"
    }
  ]
}
```

**Notes:**
- `ads`, `notifications`, and `redirects` are **always** present (each may be `[]`).
- If `requestType` is `"ad"`, `notifications` will be empty; **redirects may still be non-empty** when rules match `domain`.
- If `requestType` is `"notification"`, `ads` and **`redirects`** will be empty.
- If `requestType` is omitted, ads, notifications, and redirects may all contain items (domain required).
- Public fields only: no internal campaign IDs in payloads; the server still logs `campaignId` in **`enduser_events`**.

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
    // requestType omitted = ads + notifications + redirects (when domain matches)
  }),
});

const { ads, notifications, redirects } = await response.json();
// Apply redirects in the extension (navigate tab), not via HTTP redirect from fetch()
```

```javascript
// Get ads + redirects only (no notifications)
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

const { ads, notifications, redirects } = await response.json();
// notifications will be []
```

---

---

## 2. Response Schemas

### Ad Block Response Object

```typescript
interface AdBlockResponse {
  ads: PublicAd[];
  notifications: PublicNotification[];
  redirects: PublicRedirect[];
}

interface PublicAd {
  title: string;                 // Ad name/title
  image: string | null;          // URL to ad image/banner
  description: string | null;    // Optional description
  redirectUrl: string | null;   // URL to open when the user clicks the ad (not auto-navigation)
  htmlCode?: string | null;      // Optional HTML content
  displayAs?: 'inline' | 'popup'; // "inline" = simple ad, "popup" = show as popup
}

interface PublicNotification {
  title: string;                 // Notification title
  message: string;               // Notification message/content
  ctaLink?: string | null;       // Optional call-to-action link
}

/** Campaign redirect: extension should navigate the tab to destinationUrl when domain matches. */
interface PublicRedirect {
  sourceDomain: string;
  includeSubdomains: boolean;
  destinationUrl: string;
}
```

**Note:** The ad-block endpoint returns public fields only (no campaign IDs in the JSON). Visit and serve logging happen server-side and do not appear in the response.

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
    return { ads: [], notifications: [], redirects: [] };
  }
}

// Mirror `redirectSourceMatchesVisit` in `src/lib/domain-utils.ts` (this repo).
function normalizeHost(domain) {
  const t = domain.trim().toLowerCase();
  try {
    const url = t.startsWith('http') ? t : `https://${t}`;
    return new URL(url).hostname;
  } catch {
    return t;
  }
}

function visitMatchesRedirect(visitHost, r) {
  const host = normalizeHost(visitHost);
  const source = normalizeHost(r.sourceDomain);
  if (host === source) return true;
  if (!r.includeSubdomains) return false;
  return host.endsWith('.' + source);
}

function applyRedirects(redirects, visitHostname) {
  for (const r of redirects) {
    if (visitMatchesRedirect(visitHostname, r)) {
      window.location.assign(r.destinationUrl);
      return;
    }
  }
}

async function loadExtensionContent() {
  let token = await getStoredToken();
  if (!token) {
    // Prompt user or open /register — example only:
    token = await loginAndStoreToken('user@example.com', 'password');
  }
  const { ads, notifications, redirects } = await fetchAdBlock(token);
  if (redirects.length > 0) applyRedirects(redirects, getCurrentDomain());
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
// Use PublicAd, PublicNotification, PublicRedirect / AdBlockResponse from Response Schemas above.
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

4. **Accounts**: End users register and sign in; store the **session token** securely. Telemetry rows are keyed by the server’s **`user.identifier`** (device / install id). For **email-only** extension registration (no `identifier` in the JSON body), the API **allocates** `user.identifier` and returns it — **persist** that value client-side and send it on later **`identifier`** fields when linking devices.

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

### 2026-04-06
- Documented **`redirects`** on legacy **`POST /api/extension/ad-block`** (response shape, `requestType` interaction, client-side navigation — not HTTP redirects). Clarified v2 as preferred path; expanded examples and **`AdBlockResponse`** TypeScript.
- v2: **`POST /api/extension/serve/redirects`** (prefetch with **`domain_regex`**, **`target_url`**, **`date_till`**, **`count`**); **`serve/ads`** ads/popups only; implementation checklist in **EXTENSION_V2_API.md**.

---

## Support

For issues or questions about the API, please refer to:
- [Test Script Documentation](./TEST_EXTENSION_LOG.md) - Guide for testing the API
- [Extension Ad Block API](./EXTENSION_AD_BLOCK_API.md) - Complete API reference
- [Architecture Documentation](./ARCHITECTURE.md) - System architecture overview
- [Database Documentation](./DATABASE.md) - Database schema details
- See [README.md](./README.md) for documentation overview
