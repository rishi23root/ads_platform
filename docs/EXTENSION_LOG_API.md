# Extension Log API Reference

Reference for the browser extension: how to send request logs to the admin dashboard so they appear in Analytics.

## Endpoint

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/extension/log` |
| **Full URL** | `{BASE_URL}/api/extension/log` |

**Base URL** examples:
- Local: `http://localhost:3000`
- Production: your deployed dashboard origin (e.g. `https://your-dashboard.example.com`)

---

## Request

### Headers

| Header | Value | Required |
|--------|--------|----------|
| `Content-Type` | `application/json` | Yes |

### Body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `visitorId` | string | Yes | Unique identifier for this extension user (e.g. stable ID from storage). Same ID updates user stats and `lastSeenAt`. |
| `domain` | string | Yes | Domain where the request originated (e.g. hostname of the page). |
| `requestType` | string | Yes | One of: `"ad"` \| `"notification"` |

**Example body:**

```json
{
  "visitorId": "user-stable-id-abc",
  "domain": "example.com",
  "requestType": "ad"
}
```

Send **one JSON object per request**. Do not send multiple JSON objects in one request body.

---

## Responses

### Success (201 Created)

```json
{
  "success": true,
  "log": {
    "id": "<uuid>",
    "visitorId": "user-stable-id-abc",
    "domain": "example.com",
    "requestType": "ad",
    "createdAt": "2026-02-07T..."
  }
}
```

### Error (400 Bad Request)

- Missing or invalid `Content-Type` (must be `application/json`).
- Invalid JSON body.
- Missing required field: `"visitorId, domain, and requestType are required"`.
- Invalid `requestType`: `"requestType must be either \"ad\" or \"notification\""`.

### Error (500 Internal Server Error)

- `"Failed to log request"` — server/database error; retry with backoff if needed.

---

## Extension usage notes

1. **When to call**  
   Call once per logical event (e.g. one call when an ad is replaced, one when a notification is handled). Use two separate requests for one “pull” that has both an ad and a notification.

2. **Visitor ID**  
   Use a stable, anonymous ID (e.g. generated once and stored in extension storage). Reuse it so the dashboard can count total requests and last seen per user.

3. **Domain**  
   Use the hostname of the page where the action happened (e.g. from `new URL(tab.url).hostname` or similar).

4. **CORS**  
   Ensure the dashboard allows your extension’s origin if you call the API from a content script or non-extension context; the dashboard may need to allow that origin in CORS.

---

## Quick test (curl)

**Ad request:**

```bash
curl -X POST http://localhost:3000/api/extension/log \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123","domain":"example.com","requestType":"ad"}'
```

**Notification request:**

```bash
curl -X POST http://localhost:3000/api/extension/log \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-123","domain":"example.com","requestType":"notification"}'
```

Replace `http://localhost:3000` with your dashboard base URL when testing against staging or production.
