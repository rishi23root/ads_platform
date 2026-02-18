# Extension API Documentation

This document contains the API endpoint for browser extensions to fetch ads and notifications with automatic visit logging.

**Base URL:** `https://your-admin-dashboard-domain.com` (paths are relative, e.g. `/api/extension/ad-block`)

> **Note**: For the full reference including `/api/extension/ad-block` (with `requestType: "notification"` for notifications), `/api/extension/live` (SSE), and recommended flow, see [EXTENSION_API_REFERENCE.md](./EXTENSION_API_REFERENCE.md). For a compact cheat sheet, see [EXTENSION_AD_BLOCK_API.md](./EXTENSION_AD_BLOCK_API.md).

**Authentication:** All extension endpoints (`/api/extension/*`) are **public** — no authentication required. Do **not** use `/api/notifications`; that is the admin dashboard API and requires an authenticated session. For notifications on extension load, use `POST /api/extension/ad-block` with `{ visitorId, requestType: "notification" }`. No domain needed.

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

### Request Body

```json
{
  "visitorId": "unique-visitor-fingerprint",
  "domain": "example.com",
  "requestType": "ad"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `visitorId` | string | Yes | Unique identifier for the user (fingerprint/hash) |
| `domain` | string | For ads | Domain where the request originated. **Required when requesting ads**; omit when `requestType: "notification"` only. Supports normalization: `instagram.com`, `www.instagram.com`, etc. |
| `requestType` | string | No | Either `"ad"` or `"notification"`. If omitted, returns both ads and notifications and logs both. |

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

### Visit Logging

This endpoint automatically logs visits:
- When `requestType` is `"ad"`: One log entry with `requestType: "ad"`, `totalRequests` incremented by 1.
- When `requestType` is `"notification"`: One log entry with `requestType: "notification"`, `totalRequests` incremented by 1.
- When `requestType` is omitted: Two log entries (one for "ad", one for "notification"), `totalRequests` incremented by 2.

### Example Request

```javascript
const BASE_URL = 'https://your-admin-dashboard-domain.com';

// Get both ads and notifications (recommended)
const response = await fetch(`${BASE_URL}/api/extension/ad-block`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    visitorId: 'user-fingerprint-hash',
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
  },
  body: JSON.stringify({
    visitorId: 'user-fingerprint-hash',
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

// Get current domain
function getCurrentDomain() {
  return window.location.hostname;
}

// Generate or retrieve visitor fingerprint
async function getVisitorId() {
  // Use your fingerprinting library or generate a persistent ID
  // Example: Use localStorage to store a generated UUID
  let visitorId = localStorage.getItem('extension_visitor_id');
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem('extension_visitor_id', visitorId);
  }
  return visitorId;
}

// Fetch ads and notifications (recommended: single call)
async function fetchAdBlock(requestType) {
  try {
    const visitorId = await getVisitorId();
    const domain = getCurrentDomain();
    
    const body = {
      visitorId,
      domain,
    };
    
    // Optional: specify requestType if you only want ads or notifications
    if (requestType) {
      body.requestType = requestType; // 'ad' or 'notification'
    }
    
    const response = await fetch(`${API_BASE_URL}/api/extension/ad-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ad block: ${response.status}`);
    }
    
    const { ads, notifications } = await response.json();
    // Visit logging is automatic - no separate log call needed!
    return { ads, notifications };
  } catch (error) {
    console.error('Error fetching ad block:', error);
    return { ads: [], notifications: [] };
  }
}

// Main function to fetch and display content
async function loadExtensionContent() {
  // Single call fetches both ads and notifications, and logs both visits
  const { ads, notifications } = await fetchAdBlock();
  // Omit requestType to get both, or use 'ad' or 'notification' for specific types
  
  // Display ads
  if (ads.length > 0) {
    displayAds(ads);
  }
  
  // Display notifications
  if (notifications.length > 0) {
    displayNotifications(notifications);
  }
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

4. **Privacy**: The `visitorId` should be a persistent but anonymous identifier. Consider using:
   - Browser fingerprinting
   - localStorage-based UUID
   - Extension-specific user ID

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
- Fetch real platforms from your database
- Call the ad-block endpoint to get ads and notifications
- Automatically log visits (no separate log calls needed)
- Display results and provide links to view in the Analytics dashboard

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

---

## Support

For issues or questions about the API, please refer to:
- [Test Script Documentation](./TEST_EXTENSION_LOG.md) - Guide for testing the API
- [Extension Ad Block API](./EXTENSION_AD_BLOCK_API.md) - Complete API reference
- [Architecture Documentation](./ARCHITECTURE.md) - System architecture overview
- [Database Documentation](./DATABASE.md) - Database schema details
- See [README.md](./README.md) for documentation overview
