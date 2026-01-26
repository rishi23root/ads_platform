# Extension API Documentation

This document contains all API endpoints available for the browser extension to fetch ads and notifications.

**Base URL:** `https://your-admin-dashboard-domain.com/api`

---

## Table of Contents

1. [Get Active Ads for a Domain](#1-get-active-ads-for-a-domain)
2. [Get Active Notifications for a Domain](#2-get-active-notifications-for-a-domain)
3. [Log Extension Request (Analytics)](#3-log-extension-request-analytics)
4. [Response Schemas](#response-schemas)
5. [Usage Examples](#usage-examples)
6. [Error Handling](#error-handling)

---

## 1. Get Active Ads for a Domain

Fetches all active ads configured for a specific domain.

### Endpoint

```
GET /api/ads?domain={domain}
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | Yes | The domain to fetch ads for (e.g., `example.com`) |

### Response

**Status Code:** `200 OK`

**Response Body:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Summer Sale Banner",
    "description": "Promotional banner for summer sale",
    "imageUrl": "https://cdn.example.com/banner.jpg",
    "targetUrl": "https://example.com/sale",
    "status": "active",
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-02-01T00:00:00.000Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "New Product Launch",
    "description": "Check out our new product line",
    "imageUrl": "https://cdn.example.com/product.jpg",
    "targetUrl": "https://example.com/products",
    "status": "active",
    "startDate": "2026-01-15T00:00:00.000Z",
    "endDate": "2026-03-01T00:00:00.000Z"
  }
]
```

### Notes

- Returns only ads with `status: "active"` for the matching platform/domain
- Returns empty array `[]` if domain not found or no active ads exist
- Ads are automatically expired when their `endDate` passes

### Example Request

```javascript
const domain = window.location.hostname; // e.g., "example.com"
const response = await fetch(`https://your-admin-dashboard-domain.com/api/ads?domain=${domain}`);
const ads = await response.json();
```

---

## 2. Get Active Notifications for a Domain

Fetches all active notifications configured for a specific domain that are currently within their date range.

### Endpoint

```
GET /api/notifications?domain={domain}
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | Yes | The domain to fetch notifications for |

### Response

**Status Code:** `200 OK`

**Response Body:**

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "title": "System Maintenance",
    "message": "We will be performing scheduled maintenance on Saturday from 2 AM to 4 AM EST.",
    "startDate": "2026-01-20T00:00:00.000Z",
    "endDate": "2026-01-27T23:59:59.000Z"
  },
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "title": "New Feature Available",
    "message": "Check out our new dashboard features!",
    "startDate": "2026-01-25T00:00:00.000Z",
    "endDate": "2026-02-10T23:59:59.000Z"
  }
]
```

### Notes

- Only returns notifications where `startDate <= current_time <= endDate`
- Returns empty array `[]` if domain not found or no active notifications exist
- Notifications can be linked to multiple domains/platforms

### Example Request

```javascript
const domain = window.location.hostname; // e.g., "example.com"
const response = await fetch(`https://your-admin-dashboard-domain.com/api/notifications?domain=${domain}`);
const notifications = await response.json();
```

---

## 3. Log Extension Request (Analytics)

Logs when the extension fetches ads or notifications. This is used for analytics and tracking extension usage.

### Endpoint

```
POST /api/extension/log
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
| `domain` | string | Yes | Domain where the request originated from |
| `requestType` | string | Yes | Either `"ad"` or `"notification"` |

### Response

**Status Code:** `201 Created`

**Response Body:**

```json
{
  "success": true,
  "log": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "visitorId": "unique-visitor-fingerprint",
    "domain": "example.com",
    "requestType": "ad",
    "createdAt": "2026-01-26T10:30:00.000Z"
  }
}
```

### Example Request

```javascript
const response = await fetch('https://your-admin-dashboard-domain.com/api/extension/log', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    visitorId: 'user-fingerprint-hash',
    domain: window.location.hostname,
    requestType: 'ad', // or 'notification'
  }),
});

const result = await response.json();
```

---

## Response Schemas

### Ad Object

```typescript
interface Ad {
  id: string;                    // UUID
  name: string;                   // Ad name/title
  description: string | null;     // Optional description
  imageUrl: string | null;       // URL to ad image/banner
  targetUrl: string | null;      // URL to redirect when ad is clicked
  status: 'active' | 'inactive' | 'scheduled' | 'expired';
  startDate: string | null;      // ISO 8601 date string
  endDate: string | null;        // ISO 8601 date string
}
```

### Notification Object

```typescript
interface Notification {
  id: string;                    // UUID
  title: string;                 // Notification title
  message: string;               // Notification message/content
  startDate: string;             // ISO 8601 date string (when notification becomes active)
  endDate: string;               // ISO 8601 date string (when notification expires)
}
```

### Log Response Object

```typescript
interface LogResponse {
  success: boolean;
  log: {
    id: string;                  // UUID
    visitorId: string;           // Visitor fingerprint
    domain: string;              // Domain name
    requestType: 'ad' | 'notification';
    createdAt: string;           // ISO 8601 date string
  };
}
```

---

## Usage Examples

### Complete Extension Implementation Example

```javascript
// Configuration
const API_BASE_URL = 'https://your-admin-dashboard-domain.com/api';

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

// Fetch ads for current domain
async function fetchAds() {
  try {
    const domain = getCurrentDomain();
    const response = await fetch(`${API_BASE_URL}/ads?domain=${domain}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ads: ${response.status}`);
    }
    
    const ads = await response.json();
    return ads;
  } catch (error) {
    console.error('Error fetching ads:', error);
    return [];
  }
}

// Fetch notifications for current domain
async function fetchNotifications() {
  try {
    const domain = getCurrentDomain();
    const response = await fetch(`${API_BASE_URL}/notifications?domain=${domain}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.status}`);
    }
    
    const notifications = await response.json();
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

// Log request for analytics
async function logRequest(requestType) {
  try {
    const visitorId = await getVisitorId();
    const domain = getCurrentDomain();
    
    const response = await fetch(`${API_BASE_URL}/extension/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitorId,
        domain,
        requestType, // 'ad' or 'notification'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to log request: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error logging request:', error);
    // Don't throw - logging failures shouldn't break the extension
  }
}

// Main function to fetch and display content
async function loadExtensionContent() {
  // Fetch ads and notifications in parallel
  const [ads, notifications] = await Promise.all([
    fetchAds(),
    fetchNotifications(),
  ]);
  
  // Log the requests
  await Promise.all([
    logRequest('ad'),
    logRequest('notification'),
  ]);
  
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
    if (ad.imageUrl && ad.targetUrl) {
      // Create ad banner/element
      const adElement = document.createElement('div');
      adElement.className = 'extension-ad';
      adElement.innerHTML = `
        <a href="${ad.targetUrl}" target="_blank">
          <img src="${ad.imageUrl}" alt="${ad.name}" />
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
// types.ts
export interface Ad {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  targetUrl: string | null;
  status: 'active' | 'inactive' | 'scheduled' | 'expired';
  startDate: string | null;
  endDate: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  startDate: string;
  endDate: string;
}

// api.ts
const API_BASE_URL = 'https://your-admin-dashboard-domain.com/api';

export async function fetchAds(domain: string): Promise<Ad[]> {
  const response = await fetch(`${API_BASE_URL}/ads?domain=${domain}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ads: ${response.status}`);
  }
  return response.json();
}

export async function fetchNotifications(domain: string): Promise<Notification[]> {
  const response = await fetch(`${API_BASE_URL}/notifications?domain=${domain}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch notifications: ${response.status}`);
  }
  return response.json();
}

export async function logRequest(
  visitorId: string,
  domain: string,
  requestType: 'ad' | 'notification'
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/extension/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, domain, requestType }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to log request: ${response.status}`);
  }
}
```

---

## Error Handling

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

4. **Rate Limiting**: Be mindful of API rate limits. The logging endpoint can be called less frequently (e.g., once per session per domain).

5. **Privacy**: The `visitorId` should be a persistent but anonymous identifier. Consider using:
   - Browser fingerprinting
   - localStorage-based UUID
   - Extension-specific user ID

6. **CORS**: Ensure your admin dashboard CORS settings allow requests from your extension's origin.

---

## Testing

### Test Script

A test script is available to simulate extension pull requests and verify API functionality:

```bash
pnpm test:extension-log
```

Or run directly:

```bash
./test-extension-log.sh
```

The script will:
- Fetch real platforms and ads from your database
- Create test log entries for both 'ad' and 'notification' request types
- Display results and provide links to view in the Analytics dashboard

See [TEST_EXTENSION_LOG.md](./TEST_EXTENSION_LOG.md) for detailed documentation.

---

## Changelog

### 2026-01-27
- Added test script documentation reference
- Updated testing section with test script information

### 2026-01-26
- Initial API documentation
- Added domain filtering for ads endpoint
- Updated notifications endpoint with date range filtering
- Added analytics logging endpoint

---

## Support

For issues or questions about the API, please refer to:
- [Test Script Documentation](./TEST_EXTENSION_LOG.md) - Guide for testing the API
- [Architecture Documentation](./docs/ARCHITECTURE.md) - System architecture overview
- [Database Documentation](./docs/DATABASE.md) - Database schema details
- Admin dashboard documentation or contact the development team
